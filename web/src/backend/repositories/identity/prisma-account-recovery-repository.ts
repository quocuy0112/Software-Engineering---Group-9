import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type {
  FullAccountRecoveryFailureCode,
  FullAccountRecoveryOperation,
  Prisma,
} from "@/backend/generated/prisma/client";
import type { AccountRecoveryCapabilityKind } from "@/shared/contracts/identity/password-recovery";
import { prisma } from "@/backend/database/prisma";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PrismaOutboxRepository } from "@/backend/repositories/email/outbox-repository";
import { createInAppNotification } from "@/backend/notifications/notification-service";

export const ACCOUNT_RECOVERY_CONFIRMATION_LIFETIME_MS = 30 * 60 * 1000;
export const ACCOUNT_RECOVERY_HOLD_MS = 24 * 60 * 60 * 1000;
export const ACCOUNT_RECOVERY_COMPLETION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const ACCOUNT_RECOVERY_OPERATION_LEASE_MS = 60 * 1000;

type AuditFactory = (
  db: Prisma.TransactionClient,
) => Pick<PrismaAuditRepository, "appendIdempotent">;
type OutboxFactory = (
  db: Prisma.TransactionClient,
) => Pick<PrismaOutboxRepository, "enqueueIdempotent">;

export type ConfirmationClaimResult =
  | {
      status: "acquired";
      operation: FullAccountRecoveryOperation;
      executionOwner: string;
      claimed: boolean;
    }
  | { status: "invalid" | "used" | "expired" | "busy" };

export type CompletionClaimResult =
  | {
      status: "acquired";
      operation: FullAccountRecoveryOperation;
      executionOwner: string;
      claimed: boolean;
    }
  | {
      status: "hold";
      holdEndsAt: Date;
    }
  | { status: "invalid" | "used" | "expired" | "busy" };

function equalDigest(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export class PrismaAccountRecoveryRepository {
  constructor(
    private readonly protector = new TokenProtector(),
    private readonly auditFactory: AuditFactory = (db) =>
      new PrismaAuditRepository(db),
    private readonly outboxFactory: OutboxFactory = (db) =>
      new PrismaOutboxRepository(db),
  ) {}

  /**
   * Performs a read-only capability check before a sensitive recovery page is
   * unlocked. Mutation methods repeat all checks atomically, so this method is
   * only a route gate and can never authorize a database write by itself.
   */
  async isRouteProofValid(
    kind: AccountRecoveryCapabilityKind,
    rawProof: string,
    now = new Date(),
  ): Promise<boolean> {
    const digest = this.protector.digest(rawProof);
    if (kind === "confirmation") {
      const existing = await prisma.fullAccountRecoveryOperation.findUnique({
        where: { confirmationProofDigest: digest },
        select: {
          status: true,
          confirmationFinalizedAt: true,
        },
      });
      if (existing) {
        return (
          existing.status === "CONFIRMED_HOLD" &&
          !existing.confirmationFinalizedAt
        );
      }
      const token = await prisma.securityToken.findUnique({
        where: { tokenDigest: digest },
        select: {
          purpose: true,
          status: true,
          expiresAt: true,
          user: {
            select: {
              state: true,
              emailVerified: true,
              twoFactorEnabled: true,
            },
          },
        },
      });
      return Boolean(
        token &&
        token.purpose === "ACCOUNT_RECOVERY_CONFIRMATION" &&
        token.status === "ACTIVE" &&
        token.expiresAt > now &&
        token.user.state === "ACTIVE" &&
        token.user.emailVerified &&
        token.user.twoFactorEnabled,
      );
    }

    if (kind === "cancellation") {
      const operation = await prisma.fullAccountRecoveryOperation.findUnique({
        where: { cancellationProofDigest: digest },
        select: {
          status: true,
          confirmationFinalizedAt: true,
          cancellationConsumedAt: true,
          cancellationProofExpiresAt: true,
        },
      });
      return Boolean(
        operation &&
        operation.status === "CONFIRMED_HOLD" &&
        operation.confirmationFinalizedAt &&
        !operation.cancellationConsumedAt &&
        operation.cancellationProofExpiresAt > now,
      );
    }

    const operation = await prisma.fullAccountRecoveryOperation.findUnique({
      where: { completionProofDigest: digest },
      select: {
        status: true,
        confirmationFinalizedAt: true,
        completedAt: true,
        completionProofExpiresAt: true,
      },
    });
    return Boolean(
      operation &&
      (operation.status === "CONFIRMED_HOLD" ||
        operation.status === "COMPLETING") &&
      operation.confirmationFinalizedAt &&
      !operation.completedAt &&
      operation.completionProofExpiresAt > now,
    );
  }

  async replaceConfirmationForEligibleUser(input: {
    normalizedEmail: string;
    rawProof: string;
    protectedProof: string;
    correlationId: string;
    now?: Date;
  }): Promise<{ userId: string; tokenId: string } | null> {
    const now = input.now ?? new Date();
    return prisma.$transaction(async (tx) => {
      const user = await tx.userAccount.findUnique({
        where: { normalizedEmail: input.normalizedEmail },
        select: {
          id: true,
          state: true,
          emailVerified: true,
          twoFactorEnabled: true,
          fullAccountRecoveryOperations: {
            where: { status: { in: ["CONFIRMED_HOLD", "COMPLETING"] } },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (
        !user ||
        user.state !== "ACTIVE" ||
        !user.emailVerified ||
        !user.twoFactorEnabled ||
        user.fullAccountRecoveryOperations.length > 0
      ) {
        return null;
      }

      await tx.securityToken.updateMany({
        where: {
          userId: user.id,
          purpose: "ACCOUNT_RECOVERY_CONFIRMATION",
          status: "ACTIVE",
        },
        data: { status: "SUPERSEDED", supersededAt: now },
      });
      const token = await tx.securityToken.create({
        data: {
          userId: user.id,
          purpose: "ACCOUNT_RECOVERY_CONFIRMATION",
          status: "ACTIVE",
          tokenDigest: this.protector.digest(input.rawProof),
          expiresAt: new Date(
            now.getTime() + ACCOUNT_RECOVERY_CONFIRMATION_LIFETIME_MS,
          ),
          createdByRequestId: input.correlationId,
          createdAt: now,
        },
      });
      await this.outboxFactory(tx).enqueueIdempotent({
        kind: "SECURITY_ALERT",
        userId: user.id,
        securityTokenId: token.id,
        recipientRef: user.id,
        templateVersion: "account-recovery-confirmation.v1",
        payloadRef: {
          event: "account-recovery-confirmation",
          protectedProof: input.protectedProof,
        },
        idempotencyKey: `account-recovery-confirmation:${token.id}`,
      });
      await this.auditFactory(tx).appendIdempotent(
        `account-recovery-request:${token.id}`,
        {
          occurredAt: now,
          actorType: "anonymous",
          action: "account_recovery.requested",
          targetType: "account_recovery",
          targetId: token.id,
          result: "SUCCESS",
          correlationId: input.correlationId,
          context: { eligible: true },
        },
      );
      return { userId: user.id, tokenId: token.id };
    });
  }

  async claimOrResumeConfirmation(input: {
    rawProof: string;
    completionProof: string;
    cancellationProof: string;
    now?: Date;
  }): Promise<ConfirmationClaimResult> {
    const now = input.now ?? new Date();
    const confirmationProofDigest = this.protector.digest(input.rawProof);
    const operationKey = this.protector.digest(
      ["full-account-recovery-v1", input.rawProof].join("\0"),
    );
    const executionOwner = randomUUID();
    const leaseExpiresAt = new Date(
      now.getTime() + ACCOUNT_RECOVERY_OPERATION_LEASE_MS,
    );

    return prisma.$transaction(async (tx) => {
      const existing = await tx.fullAccountRecoveryOperation.findUnique({
        where: { confirmationProofDigest },
      });
      if (existing) {
        if (
          existing.confirmationFinalizedAt ||
          existing.status !== "CONFIRMED_HOLD" ||
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
        const changed = await tx.fullAccountRecoveryOperation.updateMany({
          where: {
            id: existing.id,
            status: "CONFIRMED_HOLD",
            confirmationFinalizedAt: null,
            operationKey,
            OR: [
              { executionOwner: null },
              { leaseExpiresAt: null },
              { leaseExpiresAt: { lte: now } },
            ],
          },
          data: {
            failureCode: null,
            retryAt: null,
            executionOwner,
            leaseExpiresAt,
          },
        });
        if (changed.count !== 1) return { status: "busy" };
        return {
          status: "acquired",
          operation: await tx.fullAccountRecoveryOperation.findUniqueOrThrow({
            where: { id: existing.id },
          }),
          executionOwner,
          claimed: false,
        };
      }

      const token = await tx.securityToken.findUnique({
        where: { tokenDigest: confirmationProofDigest },
        select: {
          id: true,
          userId: true,
          purpose: true,
          status: true,
          expiresAt: true,
          user: {
            select: {
              state: true,
              emailVerified: true,
              twoFactorEnabled: true,
            },
          },
        },
      });
      if (
        !token ||
        token.purpose !== "ACCOUNT_RECOVERY_CONFIRMATION" ||
        token.user.state !== "ACTIVE" ||
        !token.user.emailVerified ||
        !token.user.twoFactorEnabled
      ) {
        return { status: "invalid" };
      }
      if (token.status !== "ACTIVE") return { status: "used" };
      if (token.expiresAt <= now) {
        await tx.securityToken.updateMany({
          where: { id: token.id, status: "ACTIVE" },
          data: { status: "EXPIRED" },
        });
        return { status: "expired" };
      }
      const consumed = await tx.securityToken.updateMany({
        where: { id: token.id, status: "ACTIVE", expiresAt: { gt: now } },
        data: { status: "CONSUMED", consumedAt: now },
      });
      if (consumed.count !== 1) return { status: "used" };

      const id = randomUUID();
      const holdEndsAt = new Date(now.getTime() + ACCOUNT_RECOVERY_HOLD_MS);
      const confirmationAuditIntentKey = `account-recovery-confirm-intent:${id}`;
      await this.auditFactory(tx).appendIdempotent(confirmationAuditIntentKey, {
        occurredAt: now,
        actorType: "anonymous",
        action: "account_recovery.confirmation_intent_recorded",
        targetType: "account_recovery",
        targetId: id,
        result: "SUCCESS",
        correlationId: id,
        context: { stage: "hold_claimed" },
      });
      const operation = await tx.fullAccountRecoveryOperation.create({
        data: {
          id,
          userId: token.userId,
          confirmationTokenId: token.id,
          operationKey,
          confirmationProofDigest,
          confirmationExpiresAt: token.expiresAt,
          confirmationConsumedAt: now,
          completionProofDigest: this.protector.digest(input.completionProof),
          completionProofCiphertext: this.protector.seal(input.completionProof),
          completionProofExpiresAt: new Date(
            holdEndsAt.getTime() + ACCOUNT_RECOVERY_COMPLETION_WINDOW_MS,
          ),
          cancellationProofDigest: this.protector.digest(
            input.cancellationProof,
          ),
          cancellationProofCiphertext: this.protector.seal(
            input.cancellationProof,
          ),
          cancellationProofExpiresAt: holdEndsAt,
          holdStartedAt: now,
          holdEndsAt,
          confirmationAuditIntentKey,
          pendingNotificationIdempotencyKey: `account-recovery-pending:${id}`,
          cancellationNotificationIdempotencyKey: `account-recovery-cancelled:${id}`,
          completionAuditIntentKey: `account-recovery-complete-intent:${id}`,
          completionNotificationIdempotencyKey: `account-recovery-completed:${id}`,
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

  async markHoldSessionsRevoked(
    id: string,
    executionOwner: string,
    now = new Date(),
  ) {
    return this.markOwned(
      id,
      executionOwner,
      { holdSessionsRevokedAt: now },
      now,
    );
  }

  async invalidateHoldChallenges(
    operation: FullAccountRecoveryOperation,
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
          purpose: "ACCOUNT_RECOVERY_CONFIRMATION",
          status: "ACTIVE",
        },
        data: { status: "SUPERSEDED", supersededAt: now },
      });
      const changed = await tx.fullAccountRecoveryOperation.updateMany({
        where: {
          id: operation.id,
          executionOwner,
          status: "CONFIRMED_HOLD",
          confirmationFinalizedAt: null,
          holdSessionsRevokedAt: { not: null },
          holdChallengesInvalidatedAt: null,
        },
        data: {
          holdChallengesInvalidatedAt: now,
          leaseExpiresAt: new Date(
            now.getTime() + ACCOUNT_RECOVERY_OPERATION_LEASE_MS,
          ),
        },
      });
      if (changed.count !== 1) throw new Error("RECOVERY_OPERATION_NOT_OWNED");
    });
  }

  async finalizeHold(
    operation: FullAccountRecoveryOperation,
    executionOwner: string,
    now = new Date(),
  ) {
    return prisma.$transaction(async (tx) => {
      const outbox = await this.outboxFactory(tx).enqueueIdempotent({
        kind: "SECURITY_ALERT",
        userId: operation.userId,
        securityTokenId: operation.confirmationTokenId,
        recipientRef: operation.userId,
        templateVersion: "account-recovery-pending.v1",
        payloadRef: {
          event: "account-recovery-pending",
          protectedCompletionProof: operation.completionProofCiphertext,
          protectedCancellationProof: operation.cancellationProofCiphertext,
          holdEndsAt: operation.holdEndsAt.toISOString(),
        },
        idempotencyKey: operation.pendingNotificationIdempotencyKey,
      });
      await createInAppNotification(tx, {
        recipientUserId: operation.userId,
        kind: "RECOVERY_PENDING",
        deduplicationKey: operation.pendingNotificationIdempotencyKey,
        correlationId: operation.id,
        occurredAt: now,
        contextType: "ACCOUNT",
        contextId: operation.userId,
      });
      const finalAuditId = `account-recovery-confirmed:${operation.id}`;
      await this.auditFactory(tx).appendIdempotent(finalAuditId, {
        occurredAt: now,
        actorType: "anonymous",
        action: "account_recovery.hold_started",
        targetType: "account_recovery",
        targetId: operation.id,
        result: "SUCCESS",
        correlationId: operation.id,
        context: {
          holdHours: 24,
          sessionsRevoked: true,
          challengesInvalidated: true,
          twoFactorPreserved: true,
        },
      });
      const changed = await tx.fullAccountRecoveryOperation.updateMany({
        where: {
          id: operation.id,
          executionOwner,
          status: "CONFIRMED_HOLD",
          confirmationFinalizedAt: null,
          holdChallengesInvalidatedAt: { not: null },
        },
        data: {
          pendingNotificationOutboxId: outbox.id,
          pendingNotificationEnqueuedAt: now,
          confirmationFinalAuditId: finalAuditId,
          confirmationFinalizedAt: now,
          failureCode: null,
          retryAt: null,
          executionOwner: null,
          leaseExpiresAt: null,
        },
      });
      if (changed.count !== 1) throw new Error("RECOVERY_OPERATION_NOT_OWNED");
      return outbox.id;
    });
  }

  async cancel(rawProof: string, now = new Date()) {
    const cancellationProofDigest = this.protector.digest(rawProof);
    return prisma.$transaction(async (tx) => {
      const operation = await tx.fullAccountRecoveryOperation.findUnique({
        where: { cancellationProofDigest },
      });
      if (
        !operation ||
        operation.status !== "CONFIRMED_HOLD" ||
        !operation.confirmationFinalizedAt ||
        operation.cancellationConsumedAt ||
        operation.cancellationProofExpiresAt <= now
      ) {
        return null;
      }
      const changed = await tx.fullAccountRecoveryOperation.updateMany({
        where: {
          id: operation.id,
          status: "CONFIRMED_HOLD",
          confirmationFinalizedAt: { not: null },
          cancellationConsumedAt: null,
          cancellationProofExpiresAt: { gt: now },
        },
        data: {
          status: "CANCELLED",
          cancellationConsumedAt: now,
          cancelledAt: now,
          failureCode: null,
          retryAt: null,
          executionOwner: null,
          leaseExpiresAt: null,
        },
      });
      if (changed.count !== 1) return null;
      const outbox = await this.outboxFactory(tx).enqueueIdempotent({
        kind: "SECURITY_ALERT",
        userId: operation.userId,
        securityTokenId: operation.confirmationTokenId,
        recipientRef: operation.userId,
        templateVersion: "account-recovery-cancelled.v1",
        payloadRef: { event: "account-recovery-cancelled" },
        idempotencyKey: operation.cancellationNotificationIdempotencyKey,
      });
      await createInAppNotification(tx, {
        recipientUserId: operation.userId,
        kind: "RECOVERY_CANCELLED",
        deduplicationKey: operation.cancellationNotificationIdempotencyKey,
        correlationId: operation.id,
        occurredAt: now,
        contextType: "ACCOUNT",
        contextId: operation.userId,
      });
      const auditId = `account-recovery-cancelled:${operation.id}`;
      await this.auditFactory(tx).appendIdempotent(auditId, {
        occurredAt: now,
        actorType: "anonymous",
        action: "account_recovery.cancelled",
        targetType: "account_recovery",
        targetId: operation.id,
        result: "SUCCESS",
        correlationId: operation.id,
        context: { previousSessionsRemainRevoked: true },
      });
      await tx.fullAccountRecoveryOperation.update({
        where: { id: operation.id },
        data: {
          cancellationNotificationOutboxId: outbox.id,
          cancellationAuditId: auditId,
        },
      });
      return { operationId: operation.id, userId: operation.userId };
    });
  }

  async claimOrResumeCompletion(
    rawProof: string,
    newPassword: string,
    now = new Date(),
  ): Promise<CompletionClaimResult> {
    const completionProofDigest = this.protector.digest(rawProof);
    const completionKey = this.protector.digest(
      ["full-account-recovery-completion-v1", rawProof, newPassword].join("\0"),
    );
    const executionOwner = randomUUID();
    const leaseExpiresAt = new Date(
      now.getTime() + ACCOUNT_RECOVERY_OPERATION_LEASE_MS,
    );

    return prisma.$transaction(async (tx) => {
      const operation = await tx.fullAccountRecoveryOperation.findUnique({
        where: { completionProofDigest },
      });
      if (!operation || !operation.confirmationFinalizedAt) {
        return { status: "invalid" };
      }
      if (
        operation.status === "CANCELLED" ||
        operation.status === "COMPLETED"
      ) {
        return { status: "used" };
      }
      if (operation.completionProofExpiresAt <= now) {
        return { status: "expired" };
      }
      if (operation.holdEndsAt > now) {
        return { status: "hold", holdEndsAt: operation.holdEndsAt };
      }
      if (operation.status === "COMPLETING") {
        if (
          !operation.completionKey ||
          !equalDigest(operation.completionKey, completionKey)
        ) {
          return { status: "used" };
        }
        if (
          operation.executionOwner &&
          operation.leaseExpiresAt &&
          operation.leaseExpiresAt > now
        ) {
          return { status: "busy" };
        }
        const changed = await tx.fullAccountRecoveryOperation.updateMany({
          where: {
            id: operation.id,
            status: "COMPLETING",
            completionKey,
            completedAt: null,
            OR: [
              { executionOwner: null },
              { leaseExpiresAt: null },
              { leaseExpiresAt: { lte: now } },
            ],
          },
          data: {
            failureCode: null,
            retryAt: null,
            executionOwner,
            leaseExpiresAt,
          },
        });
        if (changed.count !== 1) return { status: "busy" };
        return {
          status: "acquired",
          operation: await tx.fullAccountRecoveryOperation.findUniqueOrThrow({
            where: { id: operation.id },
          }),
          executionOwner,
          claimed: false,
        };
      }
      if (operation.status !== "CONFIRMED_HOLD") return { status: "used" };

      const changed = await tx.fullAccountRecoveryOperation.updateMany({
        where: {
          id: operation.id,
          status: "CONFIRMED_HOLD",
          confirmationFinalizedAt: { not: null },
          completionConsumedAt: null,
          completionProofExpiresAt: { gt: now },
          holdEndsAt: { lte: now },
        },
        data: {
          status: "COMPLETING",
          completionConsumedAt: now,
          completionKey,
          failureCode: null,
          retryAt: null,
          executionOwner,
          leaseExpiresAt,
        },
      });
      if (changed.count !== 1) return { status: "busy" };
      await this.auditFactory(tx).appendIdempotent(
        operation.completionAuditIntentKey,
        {
          occurredAt: now,
          actorType: "anonymous",
          action: "account_recovery.completion_intent_recorded",
          targetType: "account_recovery",
          targetId: operation.id,
          result: "SUCCESS",
          correlationId: operation.id,
          context: { stage: "credential_mutation_claimed" },
        },
      );
      return {
        status: "acquired",
        operation: await tx.fullAccountRecoveryOperation.findUniqueOrThrow({
          where: { id: operation.id },
        }),
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
    return this.markOwned(
      id,
      executionOwner,
      { passwordUpdatedAt: now },
      now,
      "COMPLETING",
    );
  }

  async markTwoFactorDisabled(
    id: string,
    executionOwner: string,
    now = new Date(),
  ) {
    return this.markOwned(
      id,
      executionOwner,
      { twoFactorDisabledAt: now },
      now,
      "COMPLETING",
    );
  }

  async markCompletionSessionsRevoked(
    id: string,
    executionOwner: string,
    now = new Date(),
  ) {
    return this.markOwned(
      id,
      executionOwner,
      { completionSessionsRevokedAt: now },
      now,
      "COMPLETING",
    );
  }

  async invalidateCompletionChallenges(
    operation: FullAccountRecoveryOperation,
    executionOwner: string,
    now = new Date(),
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.authenticationChallenge.deleteMany({
        where: { userId: operation.userId },
      });
      const changed = await tx.fullAccountRecoveryOperation.updateMany({
        where: {
          id: operation.id,
          executionOwner,
          status: "COMPLETING",
          completionSessionsRevokedAt: { not: null },
          completionChallengesInvalidatedAt: null,
        },
        data: {
          completionChallengesInvalidatedAt: now,
          leaseExpiresAt: new Date(
            now.getTime() + ACCOUNT_RECOVERY_OPERATION_LEASE_MS,
          ),
        },
      });
      if (changed.count !== 1) throw new Error("RECOVERY_OPERATION_NOT_OWNED");
    });
  }

  async enqueueCompletionNotification(
    operation: FullAccountRecoveryOperation,
    executionOwner: string,
    now = new Date(),
  ) {
    return prisma.$transaction(async (tx) => {
      const outbox = await this.outboxFactory(tx).enqueueIdempotent({
        kind: "SECURITY_ALERT",
        userId: operation.userId,
        securityTokenId: operation.confirmationTokenId,
        recipientRef: operation.userId,
        templateVersion: "account-recovery-completed.v1",
        payloadRef: { event: "account-recovery-completed" },
        idempotencyKey: operation.completionNotificationIdempotencyKey,
      });
      await createInAppNotification(tx, {
        recipientUserId: operation.userId,
        kind: "RECOVERY_COMPLETED",
        deduplicationKey: operation.completionNotificationIdempotencyKey,
        correlationId: operation.id,
        occurredAt: now,
        contextType: "ACCOUNT",
        contextId: operation.userId,
      });
      const changed = await tx.fullAccountRecoveryOperation.updateMany({
        where: {
          id: operation.id,
          executionOwner,
          status: "COMPLETING",
          completionChallengesInvalidatedAt: { not: null },
          completionNotificationEnqueuedAt: null,
        },
        data: {
          completionNotificationOutboxId: outbox.id,
          completionNotificationEnqueuedAt: now,
          leaseExpiresAt: new Date(
            now.getTime() + ACCOUNT_RECOVERY_OPERATION_LEASE_MS,
          ),
        },
      });
      if (changed.count !== 1) throw new Error("RECOVERY_OPERATION_NOT_OWNED");
      return outbox.id;
    });
  }

  async appendCompletionAudit(
    operation: FullAccountRecoveryOperation,
    executionOwner: string,
    now = new Date(),
  ) {
    return prisma.$transaction(async (tx) => {
      const finalAuditId = `account-recovery-completed:${operation.id}`;
      await this.auditFactory(tx).appendIdempotent(finalAuditId, {
        occurredAt: now,
        actorType: "anonymous",
        action: "account_recovery.completed",
        targetType: "account_recovery",
        targetId: operation.id,
        result: "SUCCESS",
        correlationId: operation.id,
        context: {
          passwordOwner: "better_auth",
          twoFactorDisabled: true,
          backupCodesInvalidated: true,
          automaticSessionCreated: false,
        },
      });
      const changed = await tx.fullAccountRecoveryOperation.updateMany({
        where: {
          id: operation.id,
          executionOwner,
          status: "COMPLETING",
          completionNotificationEnqueuedAt: { not: null },
          completionAuditFinalizedAt: null,
        },
        data: {
          completionFinalAuditId: finalAuditId,
          completionAuditFinalizedAt: now,
          leaseExpiresAt: new Date(
            now.getTime() + ACCOUNT_RECOVERY_OPERATION_LEASE_MS,
          ),
        },
      });
      if (changed.count !== 1) throw new Error("RECOVERY_OPERATION_NOT_OWNED");
      return finalAuditId;
    });
  }

  async finalizeCompletion(
    id: string,
    executionOwner: string,
    now = new Date(),
  ) {
    const changed = await prisma.fullAccountRecoveryOperation.updateMany({
      where: {
        id,
        executionOwner,
        status: "COMPLETING",
        completionAuditFinalizedAt: { not: null },
        completedAt: null,
      },
      data: {
        status: "COMPLETED",
        completedAt: now,
        failureCode: null,
        retryAt: null,
        executionOwner: null,
        leaseExpiresAt: null,
        completionProofCiphertext: "",
        cancellationProofCiphertext: "",
      },
    });
    if (changed.count !== 1) throw new Error("RECOVERY_OPERATION_NOT_OWNED");
  }

  async fail(
    id: string,
    executionOwner: string,
    failureCode: FullAccountRecoveryFailureCode,
    now = new Date(),
  ) {
    const changed = await prisma.fullAccountRecoveryOperation.updateMany({
      where: {
        id,
        executionOwner,
        status: { in: ["CONFIRMED_HOLD", "COMPLETING"] },
      },
      data: {
        failureCode,
        retryAt: now,
        executionOwner: null,
        leaseExpiresAt: null,
      },
    });
    return changed.count === 1;
  }

  async hasBlockingForUser(userId: string): Promise<boolean> {
    return (
      (await prisma.fullAccountRecoveryOperation.count({
        where: { userId, status: { in: ["CONFIRMED_HOLD", "COMPLETING"] } },
      })) > 0
    );
  }

  private async markOwned(
    id: string,
    executionOwner: string,
    data: {
      holdSessionsRevokedAt?: Date;
      passwordUpdatedAt?: Date;
      twoFactorDisabledAt?: Date;
      completionSessionsRevokedAt?: Date;
    },
    now: Date,
    status: "CONFIRMED_HOLD" | "COMPLETING" = "CONFIRMED_HOLD",
  ) {
    const changed = await prisma.fullAccountRecoveryOperation.updateMany({
      where: { id, executionOwner, status },
      data: {
        ...data,
        leaseExpiresAt: new Date(
          now.getTime() + ACCOUNT_RECOVERY_OPERATION_LEASE_MS,
        ),
      },
    });
    if (changed.count !== 1) throw new Error("RECOVERY_OPERATION_NOT_OWNED");
  }
}
