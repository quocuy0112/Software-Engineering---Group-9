import "server-only";
import type { EmailKind, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
type OutboxClient =
  | Pick<typeof prisma, "emailOutbox">
  | Prisma.TransactionClient;
export type ClaimedOutbox = Prisma.EmailOutboxGetPayload<{
  include: { user: true };
}>;
export class PrismaOutboxRepository {
  constructor(private readonly db: OutboxClient = prisma) {}
  async enqueue(input: {
    kind: EmailKind;
    userId: string;
    securityTokenId: string;
    recipientRef: string;
    templateVersion: string;
    payloadRef: Prisma.InputJsonValue;
    idempotencyKey: string;
  }) {
    return this.db.emailOutbox.create({ data: input });
  }
  async claimDue(
    owner: string,
    now: Date,
    limit = 10,
    leaseMs = 60_000,
  ): Promise<ClaimedOutbox[]> {
    const leaseUntil = new Date(now.getTime() + leaseMs);
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      WITH due AS (
        SELECT "id" FROM "EmailOutbox"
        WHERE (("status" IN ('PENDING','RETRYABLE') AND "nextAttemptAt" <= ${now})
          OR ("status" = 'PROCESSING' AND "leaseExpiresAt" <= ${now}))
        ORDER BY "nextAttemptAt", "createdAt"
        FOR UPDATE SKIP LOCKED LIMIT ${limit}
      )
      UPDATE "EmailOutbox" o SET "status"='PROCESSING', "leaseOwner"=${owner},
        "leaseExpiresAt"=${leaseUntil}, "attempts"=o."attempts"+1, "updatedAt"=${now}
      FROM due WHERE o."id"=due."id" RETURNING o."id"`;
    return prisma.emailOutbox.findMany({
      where: {
        id: { in: rows.map((row) => row.id) },
        leaseOwner: owner,
        status: "PROCESSING",
      },
      include: { user: true },
    });
  }
  async claimOne(
    id: string,
    owner: string,
    now: Date,
    leaseMs = 60_000,
  ): Promise<ClaimedOutbox | null> {
    const leaseUntil = new Date(now.getTime() + leaseMs);
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      UPDATE "EmailOutbox" SET "status"='PROCESSING', "leaseOwner"=${owner},
        "leaseExpiresAt"=${leaseUntil}, "attempts"="attempts"+1, "updatedAt"=${now}
      WHERE "id"=${id} AND (("status" IN ('PENDING','RETRYABLE'))
        OR ("status"='PROCESSING' AND "leaseExpiresAt" <= ${now})) RETURNING "id"`;
    if (!rows.length) return null;
    return prisma.emailOutbox.findFirst({
      where: { id, leaseOwner: owner, status: "PROCESSING" },
      include: { user: true },
    });
  }
  async markSent(id: string, owner: string, providerMessageId: string) {
    return prisma.emailOutbox.updateMany({
      where: { id, leaseOwner: owner, status: "PROCESSING" },
      data: {
        status: "SENT",
        leaseOwner: null,
        leaseExpiresAt: null,
        providerMessageId,
        safeErrorCode: null,
      },
    });
  }
  async markFailure(input: {
    id: string;
    owner: string;
    attempts: number;
    code: string;
    retryable: boolean;
    nextAttemptAt: Date;
    kind: EmailKind;
  }) {
    const dead = !input.retryable || input.attempts >= 5;
    return prisma.$transaction(async (tx) => {
      const changed = await tx.emailOutbox.updateMany({
        where: { id: input.id, leaseOwner: input.owner, status: "PROCESSING" },
        data: {
          status: dead ? "DEAD" : "RETRYABLE",
          leaseOwner: null,
          leaseExpiresAt: null,
          nextAttemptAt: input.nextAttemptAt,
          safeErrorCode: input.code,
        },
      });
      if (
        changed.count &&
        dead &&
        !(await tx.auditEvent.findFirst({
          where: { action: "email.delivery_failed", targetId: input.id },
        }))
      ) {
        await tx.auditEvent.create({
          data: {
            actorType: "system",
            action: "email.delivery_failed",
            targetType: "email_outbox",
            targetId: input.id,
            result: "FAILURE",
            correlationId: input.id,
            context: { kind: input.kind },
          },
        });
      }
      return { changed: changed.count === 1, dead };
    });
  }
}
