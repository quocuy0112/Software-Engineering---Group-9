import "server-only";
import { randomUUID } from "node:crypto";
import type {
  PasswordResetFailureCode,
  PasswordResetOperation,
  PasswordResetOperationStatus,
} from "@/shared/generated/prisma/client";
import { BetterAuthPasswordGateway } from "@/backend/auth/better-auth/better-auth-password-gateway";
import { PrismaPasswordResetRepository } from "@/backend/repositories/identity/prisma-password-reset-repository";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PasswordPolicy } from "@/backend/auth/policy/password-policy";

export const RESET_PASSWORD_GENERIC_ERROR =
  "This password-reset link is invalid or has expired.";
export const RESET_PASSWORD_RETRYABLE_ERROR =
  "Your password reset could not be completed. Please try again.";

type ResetPasswordFailure = {
  ok: false;
  message: string;
  retryable: boolean;
};

export type ResetPasswordResult =
  | { ok: true; userId: string; operationId: string }
  | ResetPasswordFailure;

function withMilestone(
  operation: PasswordResetOperation,
  status: PasswordResetOperationStatus,
  field:
    | "passwordUpdatedAt"
    | "sessionsRevokedAt"
    | "challengesInvalidatedAt"
    | "notificationEnqueuedAt"
    | "auditFinalizedAt",
  now: Date,
): PasswordResetOperation {
  return { ...operation, status, [field]: now };
}

export class ResetPasswordService {
  constructor(
    private readonly repository = new PrismaPasswordResetRepository(),
    private readonly passwordGateway = new BetterAuthPasswordGateway(),
    private readonly audit = new PrismaAuditRepository(),
    private readonly passwordPolicy = new PasswordPolicy(),
  ) {}

  async execute(
    rawToken: string,
    newPassword: string,
    now = new Date(),
  ): Promise<ResetPasswordResult> {
    const policy = await this.passwordPolicy.evaluate(newPassword);
    if (!policy.accepted) {
      await this.recordFailure(now, "password_policy");
      return {
        ok: false,
        message: RESET_PASSWORD_GENERIC_ERROR,
        retryable: false,
      };
    }

    let claim;
    try {
      claim = await this.repository.claimOrResume(rawToken, newPassword, now);
    } catch {
      await this.recordFailure(now, "claim_or_audit_intent_unavailable");
      return this.retryableFailure;
    }
    if (claim.status === "busy") return this.retryableFailure;
    if (claim.status !== "acquired") {
      await this.recordFailure(now, `token_${claim.status}`);
      return {
        ok: false,
        message: RESET_PASSWORD_GENERIC_ERROR,
        retryable: false,
      };
    }

    let operation = claim.operation;
    const owner = claim.executionOwner;

    if (!operation.passwordUpdatedAt) {
      try {
        await this.passwordGateway.updatePassword(
          operation.userId,
          newPassword,
        );
        await this.repository.markPasswordUpdated(operation.id, owner, now);
        operation = withMilestone(
          operation,
          "PASSWORD_UPDATED",
          "passwordUpdatedAt",
          now,
        );
      } catch {
        return this.failClosed(
          operation.id,
          owner,
          "PASSWORD_UPDATE_FAILED",
          now,
        );
      }
    }

    if (!operation.sessionsRevokedAt) {
      try {
        await this.passwordGateway.revokeAllSessions(operation.userId);
        await this.repository.markSessionsRevoked(operation.id, owner, now);
        operation = withMilestone(
          operation,
          "SESSIONS_REVOKED",
          "sessionsRevokedAt",
          now,
        );
      } catch {
        return this.failClosed(
          operation.id,
          owner,
          "SESSION_REVOCATION_FAILED",
          now,
        );
      }
    }

    if (!operation.challengesInvalidatedAt) {
      try {
        await this.repository.invalidateChallengesAndResetProofs(
          operation,
          owner,
          now,
        );
        operation = withMilestone(
          operation,
          "CHALLENGES_INVALIDATED",
          "challengesInvalidatedAt",
          now,
        );
      } catch {
        return this.failClosed(
          operation.id,
          owner,
          "CHALLENGE_INVALIDATION_FAILED",
          now,
        );
      }
    }

    if (!operation.notificationEnqueuedAt) {
      try {
        await this.repository.enqueueNotification(operation, owner, now);
        operation = withMilestone(
          operation,
          "NOTIFICATION_ENQUEUED",
          "notificationEnqueuedAt",
          now,
        );
      } catch {
        return this.failClosed(
          operation.id,
          owner,
          "NOTIFICATION_ENQUEUE_FAILED",
          now,
        );
      }
    }

    if (!operation.auditFinalizedAt) {
      try {
        await this.repository.appendFinalAudit(operation, owner, now);
        operation = withMilestone(
          operation,
          "NOTIFICATION_ENQUEUED",
          "auditFinalizedAt",
          now,
        );
      } catch {
        return this.failClosed(
          operation.id,
          owner,
          "AUDIT_FINALIZATION_FAILED",
          now,
        );
      }
    }

    try {
      await this.repository.finalize(operation.id, owner, now);
    } catch {
      return this.failClosed(
        operation.id,
        owner,
        "OPERATION_FINALIZATION_FAILED",
        now,
      );
    }

    return {
      ok: true,
      userId: operation.userId,
      operationId: operation.id,
    };
  }

  private get retryableFailure(): ResetPasswordFailure {
    return {
      ok: false,
      message: RESET_PASSWORD_RETRYABLE_ERROR,
      retryable: true,
    };
  }

  private async failClosed(
    operationId: string,
    executionOwner: string,
    failureCode: PasswordResetFailureCode,
    now: Date,
  ): Promise<ResetPasswordFailure> {
    await this.repository
      .fail(operationId, executionOwner, failureCode, now)
      .catch(() => false);
    await this.recordFailure(now, failureCode.toLowerCase());
    return this.retryableFailure;
  }

  private recordFailure(occurredAt: Date, reason: string) {
    return this.audit
      .append({
        occurredAt,
        actorType: "anonymous",
        action: "password_reset.failed",
        targetType: "request",
        result: "FAILURE",
        correlationId: randomUUID(),
        context: { reason },
      })
      .catch(() => undefined);
  }
}
