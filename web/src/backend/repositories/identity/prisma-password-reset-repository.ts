import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type {
  PasswordResetFailureCode,
  PasswordResetOperation,
  PasswordResetOperationStatus,
  Prisma,
} from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PrismaOutboxRepository } from "@/backend/repositories/email/outbox-repository";

export const PASSWORD_RESET_LIFETIME_MS = 30 * 60 * 1000;
export const PASSWORD_RESET_OPERATION_LEASE_MS = 60 * 1000;

type AuditFactory = (
  db: Prisma.TransactionClient,
) => Pick<PrismaAuditRepository, "appendIdempotent">;
type OutboxFactory = (
  db: Prisma.TransactionClient,
) => Pick<PrismaOutboxRepository, "enqueueIdempotent">;

export type PasswordResetClaimResult =
  | {
      status: "acquired";
      operation: PasswordResetOperation;
      executionOwner: string;
      claimed: boolean;
    }
  | { status: "invalid" | "used" | "expired" | "busy" };

function equalDigest(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function resumableStatus(
  operation: PasswordResetOperation,
): PasswordResetOperationStatus {
  if (operation.notificationEnqueuedAt) return "NOTIFICATION_ENQUEUED";
  if (operation.challengesInvalidatedAt) return "CHALLENGES_INVALIDATED";
  if (operation.sessionsRevokedAt) return "SESSIONS_REVOKED";
  if (operation.passwordUpdatedAt) return "PASSWORD_UPDATED";
  return "CLAIMED";
}

export class PrismaPasswordResetRepository {
  constructor(
    private readonly protector = new TokenProtector(),
    private readonly auditFactory: AuditFactory = (db) =>
      new PrismaAuditRepository(db),
    private readonly outboxFactory: OutboxFactory = (db) =>
      new PrismaOutboxRepository(db),
  ) {}

  async replaceForActiveUser(input: {
    normalizedEmail: string;
    protectedToken: string;
    rawToken: string;
    correlationId: string;
    now?: Date;
  }): Promise<{ userId: string; tokenId: string } | null> {
    const now = input.now ?? new Date();
    return prisma.$transaction(async (tx) => {
      const user = await tx.userAccount.findUnique({
        where: { normalizedEmail: input.normalizedEmail },
        select: { id: true, state: true },
      });
      if (!user || user.state !== "ACTIVE") return null;

      await tx.securityToken.updateMany({
        where: {
          userId: user.id,
          purpose: "RESET_PASSWORD",
          status: "ACTIVE",
        },
        data: { status: "SUPERSEDED", supersededAt: now },
      });
      const token = await tx.securityToken.create({
        data: {
          userId: user.id,
          purpose: "RESET_PASSWORD",
          status: "ACTIVE",
          tokenDigest: this.protector.digest(input.rawToken),
          expiresAt: new Date(now.getTime() + PASSWORD_RESET_LIFETIME_MS),
          createdByRequestId: input.correlationId,
        },
      });
      await tx.emailOutbox.create({
        data: {
          kind: "RESET_PASSWORD",
          userId: user.id,
          securityTokenId: token.id,
          recipientRef: user.id,
          templateVersion: "reset-password.v1",
          payloadRef: { protectedToken: input.protectedToken },
          idempotencyKey: `password-reset:${token.id}`,
        },
      });
      return { userId: user.id, tokenId: token.id };
    });
  }

  async claimOrResume(
    rawToken: string,
    newPassword: string,
    now = new Date(),
  ): Promise<PasswordResetClaimResult> {
    const tokenDigest = this.protector.digest(rawToken);
    const operationKey = this.protector.digest(
      ["password-reset-operation-v1", rawToken, newPassword].join("\0"),
    );
    const executionOwner = randomUUID();
    const leaseExpiresAt = new Date(
      now.getTime() + PASSWORD_RESET_OPERATION_LEASE_MS,
    );

    return prisma.$transaction(async (tx) => {
      const token = await tx.securityToken.findUnique({
        where: { tokenDigest },
        select: {
          id: true,
          userId: true,
          purpose: true,
          status: true,
          expiresAt: true,
          user: { select: { state: true } },
          passwordResetOperation: true,
        },
      });
      if (!token || token.purpose !== "RESET_PASSWORD") {
        return { status: "invalid" };
      }

      const existing = token.passwordResetOperation;
      if (existing) {
        if (
          existing.status === "FINALIZED" ||
          !equalDigest(existing.operationKey, operationKey)
        ) {
          return { status: "used" };
        }
        if (
          existing.executionOwner &&
          existing.leaseExpiresAt &&
          existing.leaseExpiresAt > now
        ) {
          return { status: "busy" };
        }
        const acquired = await tx.passwordResetOperation.updateMany({
          where: {
            id: existing.id,
            operationKey,
            finalizedAt: null,
            OR: [
              { executionOwner: null },
              { leaseExpiresAt: null },
              { leaseExpiresAt: { lte: now } },
            ],
          },
          data: {
            status: resumableStatus(existing),
            failureCode: null,
            retryAt: null,
            executionOwner,
            leaseExpiresAt,
          },
        });
        if (acquired.count !== 1) return { status: "busy" };
        const operation = await tx.passwordResetOperation.findUniqueOrThrow({
          where: { id: existing.id },
        });
        return {
          status: "acquired",
          operation,
          executionOwner,
          claimed: false,
        };
      }

      if (token.status !== "ACTIVE") return { status: "used" };
      if (token.expiresAt <= now) {
        await tx.securityToken.updateMany({
          where: { id: token.id, status: "ACTIVE" },
          data: { status: "EXPIRED" },
        });
        return { status: "expired" };
      }
      if (token.user.state !== "ACTIVE") return { status: "invalid" };

      const consumed = await tx.securityToken.updateMany({
        where: { id: token.id, status: "ACTIVE", expiresAt: { gt: now } },
        data: { status: "CONSUMED", consumedAt: now },
      });
      if (consumed.count !== 1) {
        const winner = await tx.passwordResetOperation.findUnique({
          where: { securityTokenId: token.id },
        });
        if (
          winner &&
          winner.status !== "FINALIZED" &&
          equalDigest(winner.operationKey, operationKey)
        ) {
          return { status: "busy" };
        }
        return { status: "used" };
      }

      const operationId = randomUUID();
      const auditIntentKey = `password-reset-intent:${operationId}`;
      const notificationIdempotencyKey = `password-changed:${operationId}`;
      await this.auditFactory(tx).appendIdempotent(auditIntentKey, {
        occurredAt: now,
        actorType: "anonymous",
        action: "password_reset.intent_recorded",
        targetType: "password_reset",
        targetId: operationId,
        result: "SUCCESS",
        correlationId: operationId,
        context: { stage: "claimed" },
      });
      const operation = await tx.passwordResetOperation.create({
        data: {
          id: operationId,
          userId: token.userId,
          securityTokenId: token.id,
          operationKey,
          auditIntentKey,
          notificationIdempotencyKey,
          executionOwner,
          leaseExpiresAt,
          createdAt: now,
          updatedAt: now,
        },
      });
      return {
        status: "acquired",
        operation,
        executionOwner,
        claimed: true,
      };
    });
  }

  async markPasswordUpdated(
    id: string,
    executionOwner: string,
    now = new Date(),
  ) {
    return this.markMilestone(
      id,
      executionOwner,
      { passwordUpdatedAt: now, status: "PASSWORD_UPDATED" },
      now,
    );
  }

  async markSessionsRevoked(
    id: string,
    executionOwner: string,
    now = new Date(),
  ) {
    return this.markMilestone(
      id,
      executionOwner,
      { sessionsRevokedAt: now, status: "SESSIONS_REVOKED" },
      now,
    );
  }

  async invalidateChallengesAndResetProofs(
    operation: PasswordResetOperation,
    executionOwner: string,
    now = new Date(),
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.authenticationChallenge.deleteMany({
        where: { userId: operation.userId },
      });
      await tx.securityToken.updateMany({
        where: {
          userId: operation.userId,
          purpose: "RESET_PASSWORD",
          status: "ACTIVE",
          id: { not: operation.securityTokenId },
        },
        data: { status: "SUPERSEDED", supersededAt: now },
      });
      const changed = await tx.passwordResetOperation.updateMany({
        where: {
          id: operation.id,
          executionOwner,
          finalizedAt: null,
          sessionsRevokedAt: { not: null },
          challengesInvalidatedAt: null,
        },
        data: {
          challengesInvalidatedAt: now,
          status: "CHALLENGES_INVALIDATED",
          leaseExpiresAt: new Date(
            now.getTime() + PASSWORD_RESET_OPERATION_LEASE_MS,
          ),
        },
      });
      if (changed.count !== 1) throw new Error("RESET_OPERATION_NOT_OWNED");
    });
  }

  async enqueueNotification(
    operation: PasswordResetOperation,
    executionOwner: string,
    now = new Date(),
  ) {
    return prisma.$transaction(async (tx) => {
      const outbox = await this.outboxFactory(tx).enqueueIdempotent({
        kind: "PASSWORD_CHANGED",
        userId: operation.userId,
        securityTokenId: operation.securityTokenId,
        recipientRef: operation.userId,
        templateVersion: "password-changed.v1",
        payloadRef: {},
        idempotencyKey: operation.notificationIdempotencyKey,
      });
      const changed = await tx.passwordResetOperation.updateMany({
        where: {
          id: operation.id,
          executionOwner,
          finalizedAt: null,
          challengesInvalidatedAt: { not: null },
          notificationEnqueuedAt: null,
        },
        data: {
          notificationOutboxId: outbox.id,
          notificationEnqueuedAt: now,
          status: "NOTIFICATION_ENQUEUED",
          leaseExpiresAt: new Date(
            now.getTime() + PASSWORD_RESET_OPERATION_LEASE_MS,
          ),
        },
      });
      if (changed.count !== 1) throw new Error("RESET_OPERATION_NOT_OWNED");
      return outbox.id;
    });
  }

  async appendFinalAudit(
    operation: PasswordResetOperation,
    executionOwner: string,
    now = new Date(),
  ) {
    return prisma.$transaction(async (tx) => {
      const finalAuditId = `password-reset-final:${operation.id}`;
      await this.auditFactory(tx).appendIdempotent(finalAuditId, {
        occurredAt: now,
        actorType: "anonymous",
        action: "password_reset.succeeded",
        targetType: "password_reset",
        targetId: operation.id,
        result: "SUCCESS",
        correlationId: operation.id,
        context: {
          passwordOwner: "better_auth",
          sessionRevocation: "all",
          twoFactorPreserved: true,
        },
      });
      const changed = await tx.passwordResetOperation.updateMany({
        where: {
          id: operation.id,
          executionOwner,
          finalizedAt: null,
          notificationEnqueuedAt: { not: null },
          auditFinalizedAt: null,
        },
        data: {
          finalAuditId,
          auditFinalizedAt: now,
          leaseExpiresAt: new Date(
            now.getTime() + PASSWORD_RESET_OPERATION_LEASE_MS,
          ),
        },
      });
      if (changed.count !== 1) throw new Error("RESET_OPERATION_NOT_OWNED");
      return finalAuditId;
    });
  }

  async finalize(
    id: string,
    executionOwner: string,
    now = new Date(),
  ) {
    const changed = await prisma.passwordResetOperation.updateMany({
      where: {
        id,
        executionOwner,
        finalizedAt: null,
        auditFinalizedAt: { not: null },
      },
      data: {
        status: "FINALIZED",
        finalizedAt: now,
        failureCode: null,
        retryAt: null,
        executionOwner: null,
        leaseExpiresAt: null,
      },
    });
    if (changed.count !== 1) throw new Error("RESET_OPERATION_NOT_OWNED");
  }

  async fail(
    id: string,
    executionOwner: string,
    failureCode: PasswordResetFailureCode,
    now = new Date(),
  ) {
    const changed = await prisma.passwordResetOperation.updateMany({
      where: { id, executionOwner, finalizedAt: null },
      data: {
        status: "FAILED_RETRYABLE",
        failureCode,
        retryAt: now,
        executionOwner: null,
        leaseExpiresAt: null,
      },
    });
    return changed.count === 1;
  }

  async hasIncompleteForUser(userId: string): Promise<boolean> {
    return (
      (await prisma.passwordResetOperation.count({
        where: { userId, finalizedAt: null },
      })) > 0
    );
  }

  private async markMilestone(
    id: string,
    executionOwner: string,
    data: {
      status: PasswordResetOperationStatus;
      passwordUpdatedAt?: Date;
      sessionsRevokedAt?: Date;
    },
    now: Date,
  ) {
    const changed = await prisma.passwordResetOperation.updateMany({
      where: { id, executionOwner, finalizedAt: null },
      data: {
        ...data,
        leaseExpiresAt: new Date(
          now.getTime() + PASSWORD_RESET_OPERATION_LEASE_MS,
        ),
      },
    });
    if (changed.count !== 1) throw new Error("RESET_OPERATION_NOT_OWNED");
  }
}
