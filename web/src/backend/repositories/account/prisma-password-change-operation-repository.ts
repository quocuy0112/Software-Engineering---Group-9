import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  PasswordChangeFailureCode,
  PasswordChangeOperation,
  Prisma,
} from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { serverEnvironment } from "@/backend/env/runtime";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PrismaOutboxRepository } from "@/backend/repositories/email/outbox-repository";
import { PrismaPasswordChangeAttemptRepository } from "./prisma-password-change-attempt-repository";
import { ProtectedOutboxRecipient } from "@/backend/security/protected-recipient/protected-outbox-recipient";
import type { PasswordChangeRequest } from "@/shared/contracts/account/password-change";

const SESSION_IDLE_MS = 30 * 60 * 1_000;

export class PasswordChangeRepositoryIdempotencyConflictError extends Error {
  constructor() {
    super("PASSWORD_CHANGE_IDEMPOTENCY_CONFLICT");
  }
}

export class PasswordChangeRepositorySessionMismatchError extends Error {
  constructor() {
    super("PASSWORD_CHANGE_SESSION_MISMATCH");
  }
}

function safeEqual(left: string, right: string): boolean {
  const first = Buffer.from(left, "hex");
  const second = Buffer.from(right, "hex");
  return (
    first.length === second.length &&
    first.length > 0 &&
    timingSafeEqual(first, second)
  );
}

export class PasswordChangeSubmissionBinder {
  constructor(private readonly secret = serverEnvironment.TOKEN_SECRET) {
    if (Buffer.byteLength(secret, "utf8") < 32) {
      throw new Error("PASSWORD_CHANGE_BINDING_SECRET_INVALID");
    }
  }

  digest(
    operation: Pick<
      PasswordChangeOperation,
      "id" | "userId" | "idempotencyKey" | "initiatingSessionId"
    >,
    submission: PasswordChangeRequest,
  ): string {
    const fields = [
      "password-change-submission:v1",
      operation.id,
      operation.userId,
      operation.idempotencyKey,
      operation.initiatingSessionId,
      submission.currentPassword,
      submission.newPassword,
      submission.newPasswordConfirmation,
    ];
    const hmac = createHmac("sha256", this.secret);
    for (const field of fields) {
      hmac.update(String(Buffer.byteLength(field, "utf8")));
      hmac.update(":");
      hmac.update(field, "utf8");
      hmac.update("\0");
    }
    return hmac.digest("hex");
  }

  matches(
    operation: PasswordChangeOperation,
    submission: PasswordChangeRequest,
  ): boolean {
    return safeEqual(
      operation.submissionBindingDigest,
      this.digest(operation, submission),
    );
  }
}

export class PrismaPasswordChangeOperationRepository {
  constructor(
    private readonly binder = new PasswordChangeSubmissionBinder(),
    private readonly recipients = new ProtectedOutboxRecipient(),
  ) {}

  find(
    userId: string,
    idempotencyKey: string,
  ): Promise<PasswordChangeOperation | null> {
    return prisma.passwordChangeOperation.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
  }

  matchesSubmission(
    operation: PasswordChangeOperation,
    submission: PasswordChangeRequest,
  ): boolean {
    return this.binder.matches(operation, submission);
  }

  async createIntent(input: {
    userId: string;
    sessionId: string;
    idempotencyKey: string;
    submission: PasswordChangeRequest;
    correlationId: string;
    ipPrefixDigest: string;
    now: Date;
  }): Promise<PasswordChangeOperation> {
    return prisma.$transaction(async (tx) => {
      await this.lockActiveAccount(tx, input.userId);
      const existing = await tx.passwordChangeOperation.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) {
        if (!this.binder.matches(existing, input.submission)) {
          throw new PasswordChangeRepositoryIdempotencyConflictError();
        }
        if (existing.initiatingSessionId !== input.sessionId) {
          throw new PasswordChangeRepositorySessionMismatchError();
        }
        return existing;
      }
      const id = randomUUID();
      const identity = {
        id,
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        initiatingSessionId: input.sessionId,
      };
      await new PrismaAuditRepository(tx).appendIdempotent(
        `password-change-intent:${id}`,
        {
          occurredAt: input.now,
          actorType: "user",
          actorUserId: input.userId,
          actorSessionId: input.sessionId,
          action: "password_change.intent_recorded",
          targetType: "password_change",
          targetId: id,
          result: "SUCCESS",
          correlationId: input.correlationId,
          ipPrefixDigest: input.ipPrefixDigest,
          context: { stage: "intent_recorded" },
        },
      );
      return tx.passwordChangeOperation.create({
        data: {
          ...identity,
          submissionBindingDigest: this.binder.digest(
            identity,
            input.submission,
          ),
          notificationIdempotencyKey: `password-change-notice:${id}`,
          createdAt: input.now,
          updatedAt: input.now,
        },
      });
    });
  }

  async markPasswordUpdated(id: string, now: Date): Promise<void> {
    const changed = await prisma.passwordChangeOperation.updateMany({
      where: { id, finalizedAt: null, passwordUpdatedAt: null },
      data: {
        passwordUpdatedAt: now,
        status: "PASSWORD_UPDATED",
        failureCode: null,
        retryAt: null,
      },
    });
    if (
      changed.count !== 1 &&
      !(await prisma.passwordChangeOperation.findFirst({
        where: { id, passwordUpdatedAt: { not: null } },
        select: { id: true },
      }))
    ) {
      throw new Error("PASSWORD_CHANGE_OPERATION_UNAVAILABLE");
    }
  }

  async markOtherSessionsRevoked(id: string, now: Date): Promise<void> {
    const changed = await prisma.passwordChangeOperation.updateMany({
      where: {
        id,
        finalizedAt: null,
        passwordUpdatedAt: { not: null },
        otherSessionsRevokedAt: null,
      },
      data: {
        otherSessionsRevokedAt: now,
        status: "OTHER_SESSIONS_REVOKED",
        failureCode: null,
        retryAt: null,
      },
    });
    if (
      changed.count !== 1 &&
      !(await prisma.passwordChangeOperation.findFirst({
        where: { id, otherSessionsRevokedAt: { not: null } },
        select: { id: true },
      }))
    ) {
      throw new Error("PASSWORD_CHANGE_OPERATION_UNAVAILABLE");
    }
  }

  async verifyNoOtherUsableSessions(
    userId: string,
    initiatingSessionId: string,
    now: Date,
  ): Promise<boolean> {
    return (
      (await prisma.session.count({
        where: {
          userId,
          id: { not: initiatingSessionId },
          revokedAt: null,
          expiresAt: { gt: now },
          absoluteExpiresAt: { gt: now },
          lastActivityAt: {
            gt: new Date(now.getTime() - SESSION_IDLE_MS),
          },
        },
      })) === 0
    );
  }

  async fail(
    id: string,
    failureCode: PasswordChangeFailureCode,
    now: Date,
    ipPrefixDigest?: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const operation = await tx.passwordChangeOperation.findUnique({
        where: { id },
      });
      if (!operation || operation.finalizedAt) return;
      await tx.passwordChangeOperation.update({
        where: { id },
        data: {
          status: "FAILED_RETRYABLE",
          failureCode,
          retryAt: now,
        },
      });
      await new PrismaAuditRepository(tx).append({
        occurredAt: now,
        actorType: "user",
        actorUserId: operation.userId,
        actorSessionId: operation.initiatingSessionId,
        action: "password_change.failed",
        targetType: "password_change",
        targetId: id,
        result: "FAILURE",
        correlationId: id,
        ipPrefixDigest,
        context: { failureCode },
      });
    });
  }

  async recordRejected(input: {
    userId: string;
    sessionId: string;
    correlationId: string;
    ipPrefixDigest: string;
    reason: string;
    now: Date;
  }): Promise<void> {
    await new PrismaAuditRepository().append({
      occurredAt: input.now,
      actorType: "user",
      actorUserId: input.userId,
      actorSessionId: input.sessionId,
      action: "password_change.failed",
      targetType: "password_change",
      targetId: input.userId,
      result: "DENIED",
      correlationId: input.correlationId,
      ipPrefixDigest: input.ipPrefixDigest,
      context: { reason: input.reason },
    });
  }

  async finalize(
    operation: PasswordChangeOperation,
    input: {
      sessionId: string;
      correlationId: string;
      ipPrefixDigest: string;
      now: Date;
    },
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "PasswordChangeOperation"
        WHERE "id" = ${operation.id}
        FOR UPDATE
      `;
      if (locked.length !== 1) {
        throw new Error("PASSWORD_CHANGE_OPERATION_UNAVAILABLE");
      }
      const current = await tx.passwordChangeOperation.findUniqueOrThrow({
        where: { id: operation.id },
      });
      if (current.status === "FINALIZED") return;
      if (
        !current.passwordUpdatedAt ||
        !current.otherSessionsRevokedAt ||
        current.initiatingSessionId !== input.sessionId
      ) {
        throw new Error("PASSWORD_CHANGE_FINALIZATION_PRECONDITION");
      }
      const account = await tx.userAccount.findUnique({
        where: { id: current.userId },
        select: { email: true, state: true, deletedAt: true },
      });
      if (
        !account ||
        account.state !== "ACTIVE" ||
        account.deletedAt !== null
      ) {
        throw new Error("ACCOUNT_UNAVAILABLE");
      }
      const outbox = await new PrismaOutboxRepository(tx).enqueueIdempotent({
        kind: "PASSWORD_CHANGED",
        userId: current.userId,
        recipientRef: current.userId,
        recipientCiphertext: this.recipients.seal(
          account.email,
          "password-change-notice.v1",
        ),
        recipientPurpose: "password-change-notice.v1",
        templateVersion: "password-changed.v2",
        payloadRef: {},
        idempotencyKey: current.notificationIdempotencyKey,
      });
      const finalAuditId = `password-change-final:${current.id}`;
      await new PrismaAuditRepository(tx).appendIdempotent(finalAuditId, {
        occurredAt: input.now,
        actorType: "user",
        actorUserId: current.userId,
        actorSessionId: current.initiatingSessionId,
        action: "password_change.succeeded",
        targetType: "password_change",
        targetId: current.id,
        result: "SUCCESS",
        correlationId: input.correlationId,
        ipPrefixDigest: input.ipPrefixDigest,
        context: {
          passwordOwner: "better_auth",
          otherSessionsRevoked: true,
        },
      });
      await PrismaPasswordChangeAttemptRepository.clearInTransaction(
        tx,
        current.userId,
      );
      const changed = await tx.passwordChangeOperation.updateMany({
        where: {
          id: current.id,
          finalizedAt: null,
          passwordUpdatedAt: { not: null },
          otherSessionsRevokedAt: { not: null },
        },
        data: {
          notificationOutboxId: outbox.id,
          finalAuditId,
          status: "FINALIZED",
          failureCode: null,
          retryAt: null,
          finalizedAt: input.now,
        },
      });
      if (changed.count !== 1) {
        throw new Error("PASSWORD_CHANGE_OPERATION_FINALIZATION_FAILED");
      }
    });
  }

  private async lockActiveAccount(
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
