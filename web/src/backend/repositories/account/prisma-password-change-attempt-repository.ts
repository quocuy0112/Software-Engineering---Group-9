import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";

export const PASSWORD_CHANGE_WINDOW_MS = 15 * 60 * 1_000;
export const PASSWORD_CHANGE_LOCK_MS = 15 * 60 * 1_000;
export const PASSWORD_CHANGE_MAX_FAILURES = 5;

export type PasswordChangeAttemptStatus = {
  locked: boolean;
  failureCount: number;
  retryAfterSeconds?: number;
};

export function prunePasswordChangeFailures(
  timestamps: Date[],
  now: Date,
): Date[] {
  const threshold = now.getTime() - PASSWORD_CHANGE_WINDOW_MS;
  return timestamps
    .filter((value) => value.getTime() >= threshold)
    .sort((left, right) => left.getTime() - right.getTime())
    .slice(-PASSWORD_CHANGE_MAX_FAILURES);
}

export function appendWrongCurrentFailure(
  timestamps: Date[],
  now: Date,
): { failureTimestamps: Date[]; lockedUntil: Date | null } {
  if (Number.isNaN(now.getTime()))
    throw new Error("PASSWORD_CHANGE_TIME_INVALID");
  const failureTimestamps = [
    ...prunePasswordChangeFailures(timestamps, now),
    now,
  ]
    .sort((left, right) => left.getTime() - right.getTime())
    .slice(-PASSWORD_CHANGE_MAX_FAILURES);
  const lockBase = failureTimestamps.reduce(
    (latest, value) => Math.max(latest, value.getTime()),
    now.getTime(),
  );
  return {
    failureTimestamps,
    lockedUntil:
      failureTimestamps.length === PASSWORD_CHANGE_MAX_FAILURES
        ? new Date(lockBase + PASSWORD_CHANGE_LOCK_MS)
        : null,
  };
}

export function passwordChangeRetryAfterSeconds(
  lockedUntil: Date | null,
  now: Date,
): number | null {
  if (!lockedUntil || lockedUntil <= now) return null;
  return Math.max(
    1,
    Math.min(
      PASSWORD_CHANGE_LOCK_MS / 1_000,
      Math.ceil((lockedUntil.getTime() - now.getTime()) / 1_000),
    ),
  );
}

export function shouldCountPasswordChangeFailure(code: string): boolean {
  return code === "CURRENT_PASSWORD_INVALID";
}

type AttemptClient = Pick<
  Prisma.TransactionClient,
  "passwordChangeAttemptWindow"
>;

export class PrismaPasswordChangeAttemptRepository {
  async status(
    userId: string,
    now = new Date(),
  ): Promise<PasswordChangeAttemptStatus> {
    return prisma.$transaction(async (tx) => {
      await this.lockAccount(tx, userId);
      const row = await tx.passwordChangeAttemptWindow.findUnique({
        where: { userId },
      });
      if (!row) return { locked: false, failureCount: 0 };
      const retryAfterSeconds = passwordChangeRetryAfterSeconds(
        row.lockedUntil,
        now,
      );
      const failureTimestamps = prunePasswordChangeFailures(
        row.failureTimestamps,
        now,
      );
      if (
        retryAfterSeconds === null &&
        (row.lockedUntil !== null ||
          failureTimestamps.length !== row.failureTimestamps.length)
      ) {
        await tx.passwordChangeAttemptWindow.update({
          where: { userId },
          data: { failureTimestamps, lockedUntil: null },
        });
      }
      return retryAfterSeconds === null
        ? { locked: false, failureCount: failureTimestamps.length }
        : {
            locked: true,
            failureCount: row.failureTimestamps.length,
            retryAfterSeconds,
          };
    });
  }

  async recordWrongCurrent(input: {
    userId: string;
    sessionId: string;
    correlationId: string;
    ipPrefixDigest: string;
    now?: Date;
  }): Promise<PasswordChangeAttemptStatus> {
    const now = input.now ?? new Date();
    return prisma.$transaction(async (tx) => {
      await this.lockAccount(tx, input.userId);
      const previous = await tx.passwordChangeAttemptWindow.findUnique({
        where: { userId: input.userId },
      });
      const existingRetry = passwordChangeRetryAfterSeconds(
        previous?.lockedUntil ?? null,
        now,
      );
      if (existingRetry !== null) {
        return {
          locked: true,
          failureCount: previous?.failureTimestamps.length ?? 5,
          retryAfterSeconds: existingRetry,
        };
      }
      const next = appendWrongCurrentFailure(
        previous?.failureTimestamps ?? [],
        now,
      );
      await tx.passwordChangeAttemptWindow.upsert({
        where: { userId: input.userId },
        update: next,
        create: { userId: input.userId, ...next },
      });
      const audit = new PrismaAuditRepository(tx);
      await audit.append({
        occurredAt: now,
        actorType: "user",
        actorUserId: input.userId,
        actorSessionId: input.sessionId,
        action: "password_change.failed",
        targetType: "password_change",
        targetId: input.userId,
        result: "DENIED",
        correlationId: input.correlationId,
        ipPrefixDigest: input.ipPrefixDigest,
        context: {
          reason: "current_password_invalid",
          count: next.failureTimestamps.length,
        },
      });
      if (next.lockedUntil) {
        await audit.append({
          occurredAt: now,
          actorType: "user",
          actorUserId: input.userId,
          actorSessionId: input.sessionId,
          action: "password_change.locked",
          targetType: "password_change",
          targetId: input.userId,
          result: "DENIED",
          correlationId: input.correlationId,
          ipPrefixDigest: input.ipPrefixDigest,
          context: { count: next.failureTimestamps.length },
        });
      }
      return next.lockedUntil
        ? {
            locked: true,
            failureCount: next.failureTimestamps.length,
            retryAfterSeconds: PASSWORD_CHANGE_LOCK_MS / 1_000,
          }
        : {
            locked: false,
            failureCount: next.failureTimestamps.length,
          };
    });
  }

  async clear(userId: string): Promise<void> {
    await prisma.passwordChangeAttemptWindow.deleteMany({ where: { userId } });
  }

  static async clearInTransaction(
    tx: AttemptClient,
    userId: string,
  ): Promise<void> {
    await tx.passwordChangeAttemptWindow.deleteMany({ where: { userId } });
  }

  private async lockAccount(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "user"
      WHERE "id" = ${userId}
        AND "state" = 'ACTIVE'
        AND "deletedAt" IS NULL
      FOR UPDATE
    `;
    if (rows.length !== 1) throw new Error("ACCOUNT_UNAVAILABLE");
  }
}
