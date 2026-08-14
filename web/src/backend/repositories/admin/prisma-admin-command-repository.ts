import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";

export type AdminCommandIdentity = {
  actorUserId: string;
  actorSessionId: string;
  grantId: string;
  commandKind: string;
  targetReference: string;
  idempotencyKey: string;
  normalizedBody: unknown;
};

export class AdminCommandConflict extends Error {
  constructor(
    public readonly code: "STALE_CONFLICT" | "IDEMPOTENCY_CONFLICT",
    public readonly currentVersion?: number,
  ) {
    super(code);
  }
}

export class AdminCommandDenied extends Error {
  constructor(public readonly payload: Record<string, unknown>) {
    super("ACTION_BLOCKED");
  }
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export class PrismaAdminCommandRepository {
  async execute<T extends { version?: number }>(
    identity: AdminCommandIdentity,
    operation: (
      tx: Prisma.TransactionClient,
      correlationId: string,
    ) => Promise<T>,
  ): Promise<T & { correlationId: string; replayed?: boolean }> {
    const actorSubjectDigest = digest({
      userId: identity.actorUserId,
      sessionId: identity.actorSessionId,
      grantId: identity.grantId,
    });
    const normalizedBodyDigest = digest(identity.normalizedBody);
    return prisma.$transaction(async (tx) => {
      const existing = await tx.adminCommandReceipt.findUnique({
        where: {
          actorSubjectDigest_idempotencyKey: {
            actorSubjectDigest,
            idempotencyKey: identity.idempotencyKey,
          },
        },
      });
      if (existing) {
        if (
          existing.normalizedBodyDigest !== normalizedBodyDigest ||
          existing.targetReference !== identity.targetReference ||
          existing.commandKind !== identity.commandKind
        ) {
          throw new AdminCommandConflict("IDEMPOTENCY_CONFLICT");
        }
        const result =
          existing.resultPayload &&
          typeof existing.resultPayload === "object" &&
          !Array.isArray(existing.resultPayload)
            ? existing.resultPayload
            : { version: existing.resultingVersion ?? undefined };
        return {
          ...result,
          correlationId: existing.correlationId,
          replayed: true,
        } as T & { correlationId: string; replayed: true };
      }
      const correlationId = crypto.randomUUID();
      let result: T;
      let resultCode: "SUCCESS" | "DENIED" = "SUCCESS";
      try {
        result = await operation(tx, correlationId);
      } catch (error) {
        if (!(error instanceof AdminCommandDenied)) throw error;
        result = error.payload as T;
        resultCode = "DENIED";
      }
      await tx.adminCommandReceipt.create({
        data: {
          actorSubjectDigest,
          commandKind: identity.commandKind,
          targetReference: identity.targetReference,
          idempotencyKey: identity.idempotencyKey,
          normalizedBodyDigest,
          resultCode,
          resultingVersion: result.version ?? null,
          resultPayload: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
          correlationId,
        },
      });
      return { ...result, correlationId };
    });
  }
}
