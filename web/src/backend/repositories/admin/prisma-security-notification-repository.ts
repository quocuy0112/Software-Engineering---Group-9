import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";

type Client = Pick<typeof prisma, "securityNotificationWork"> | Prisma.TransactionClient;

export class PrismaSecurityNotificationRepository {
  constructor(private readonly db: Client = prisma) {}
  enqueue(data: Prisma.SecurityNotificationWorkUncheckedCreateInput) {
    return this.db.securityNotificationWork.upsert({
      where: { idempotencyKey: data.idempotencyKey },
      update: {},
      create: data,
    });
  }
  async leaseDue(now: Date, leaseOwner: string, limit = 25) {
    if ("$transaction" in this.db) {
      return prisma.$transaction(async (tx) => {
        const candidates = await tx.securityNotificationWork.findMany({
          where: {
            status: { in: ["PENDING", "RETRYING"] },
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
        nextAttemptAt: { lte: now },
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    });
  }
}
