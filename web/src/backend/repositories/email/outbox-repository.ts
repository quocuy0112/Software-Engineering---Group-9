import "server-only";
import { isDeepStrictEqual } from "node:util";
import type { EmailKind, Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import {
  protectedRecipientPurposes,
  type ProtectedRecipientPurpose,
} from "@/backend/security/protected-recipient/protected-outbox-recipient";
type OutboxClient =
  | Pick<typeof prisma, "emailOutbox">
  | Prisma.TransactionClient;
export type ClaimedOutbox = Prisma.EmailOutboxGetPayload<{
  include: { user: true };
}>;

export type OutboxIntent = {
  kind: EmailKind;
  userId?: string;
  securityTokenId?: string;
  recipientRef: string;
  recipientCiphertext?: string;
  recipientPurpose?: ProtectedRecipientPurpose;
  templateVersion: string;
  payloadRef: Prisma.InputJsonValue;
  idempotencyKey: string;
};

function validateIntent(input: OutboxIntent): OutboxIntent {
  if (
    !input.recipientRef ||
    !input.templateVersion ||
    !input.idempotencyKey ||
    input.idempotencyKey.length > 200
  ) {
    throw new Error("OUTBOX_INTENT_INVALID");
  }
  if (Boolean(input.recipientCiphertext) !== Boolean(input.recipientPurpose)) {
    throw new Error("OUTBOX_RECIPIENT_SNAPSHOT_INCOMPLETE");
  }
  if (
    input.recipientPurpose &&
    !(protectedRecipientPurposes as readonly string[]).includes(
      input.recipientPurpose,
    )
  ) {
    throw new Error("OUTBOX_RECIPIENT_PURPOSE_INVALID");
  }
  return input;
}

function sameIntent(
  existing: {
    kind: EmailKind;
    recipientRef: string;
    recipientCiphertext: string | null;
    recipientPurpose: string | null;
    templateVersion: string;
    payloadRef: Prisma.JsonValue;
  },
  intent: OutboxIntent,
): boolean {
  return (
    existing.kind === intent.kind &&
    existing.recipientRef === intent.recipientRef &&
    existing.recipientCiphertext === (intent.recipientCiphertext ?? null) &&
    existing.recipientPurpose === (intent.recipientPurpose ?? null) &&
    existing.templateVersion === intent.templateVersion &&
    isDeepStrictEqual(existing.payloadRef, intent.payloadRef)
  );
}

export class PrismaOutboxRepository {
  constructor(private readonly db: OutboxClient = prisma) {}
  async enqueue(input: OutboxIntent) {
    return this.db.emailOutbox.create({ data: validateIntent(input) });
  }
  async enqueueIdempotent(input: OutboxIntent) {
    const intent = validateIntent(input);
    let originalError: unknown;
    try {
      const result = await this.db.emailOutbox.upsert({
        where: { idempotencyKey: intent.idempotencyKey },
        update: {},
        create: intent,
      });
      if (!sameIntent(result, intent)) {
        throw new Error("OUTBOX_IDEMPOTENCY_CONFLICT");
      }
      return result;
    } catch (error) {
      originalError = error;
    }
    const existing = await this.db.emailOutbox.findUnique({
      where: { idempotencyKey: intent.idempotencyKey },
    });
    if (!existing) throw originalError;
    if (!sameIntent(existing, intent)) {
      throw new Error("OUTBOX_IDEMPOTENCY_CONFLICT");
    }
    return existing;
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
