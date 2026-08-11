import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { reconcileSecurityNotificationForOutbox } from "@/backend/admin/notifications/security-notification-status";

type Client =
  | Pick<typeof prisma, "securityNotificationWork">
  | Prisma.TransactionClient;

export class PrismaSecurityNotificationRepository {
  constructor(private readonly db: Client = prisma) {}
  enqueue(data: Prisma.SecurityNotificationWorkUncheckedCreateInput) {
    return this.db.securityNotificationWork.upsert({
      where: { idempotencyKey: data.idempotencyKey },
      update: {},
      create: data,
    });
  }
  async linkOutbox(input: { workId: string; emailOutboxId: string }) {
    return prisma.$transaction(async (tx) => {
      const changed = await tx.securityNotificationWork.updateMany({
        where: { id: input.workId, emailOutboxId: null },
        data: {
          emailOutboxId: input.emailOutboxId,
          status: "PENDING",
          nextAttemptAt: null,
          failureCategory: null,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      await reconcileSecurityNotificationForOutbox(tx, input.emailOutboxId);
      return changed;
    });
  }
  releaseEnqueueFailure(input: { workId: string; now: Date }) {
    return this.db.securityNotificationWork.updateMany({
      where: { id: input.workId, emailOutboxId: null },
      data: {
        status: "PENDING",
        nextAttemptAt: new Date(input.now.getTime() + 60_000),
        failureCategory: "TEMPORARY_UNAVAILABLE",
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
  }
  async reconcileLinked(limit = 100) {
    const rows = await prisma.securityNotificationWork.findMany({
      where: { emailOutboxId: { not: null } },
      select: { emailOutboxId: true },
      orderBy: { updatedAt: "asc" },
      take: limit,
    });
    let changed = 0;
    for (const row of rows) {
      const result = await prisma.$transaction((tx) =>
        reconcileSecurityNotificationForOutbox(tx, row.emailOutboxId!),
      );
      changed += result.count;
    }
    return changed;
  }
  async leaseDue(now: Date, leaseOwner: string, limit = 25) {
    if ("$transaction" in this.db) {
      return prisma.$transaction(async (tx) => {
        const candidates = await tx.securityNotificationWork.findMany({
          where: {
            status: { in: ["PENDING", "RETRYING"] },
            emailOutboxId: null,
            nextAttemptAt: { lte: now },
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
          },
          select: { id: true },
          orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
          take: limit,
        });
        const ids = candidates.map((row) => row.id);
        if (!ids.length) return [];
        await tx.securityNotificationWork.updateMany({
          where: {
            id: { in: ids },
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
          },
          data: {
            leaseOwner,
            leaseExpiresAt: new Date(now.getTime() + 60_000),
          },
        });
        return tx.securityNotificationWork.findMany({
          where: { id: { in: ids }, leaseOwner },
          orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
        });
      });
    }
    return this.db.securityNotificationWork.findMany({
      where: {
        status: { in: ["PENDING", "RETRYING"] },
        emailOutboxId: null,
        nextAttemptAt: { lte: now },
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    });
  }
}
