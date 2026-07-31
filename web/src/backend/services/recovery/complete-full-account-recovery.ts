import "server-only";
import { randomUUID } from "node:crypto";
import type {
  FullAccountRecoveryFailureCode,
  FullAccountRecoveryOperation,
} from "@/backend/generated/prisma/client";
import { ACCOUNT_RECOVERY_GENERIC_ERROR } from "@/shared/contracts/identity/password-recovery";
import { PasswordPolicy } from "@/backend/auth/policy/password-policy";
import { BetterAuthPasswordGateway } from "@/backend/auth/better-auth/better-auth-password-gateway";
import { BetterAuthTwoFactorGateway } from "@/backend/auth/better-auth/better-auth-two-factor-gateway";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PrismaAccountRecoveryRepository } from "@/backend/repositories/identity/prisma-account-recovery-repository";

type CompletionFailure = {
  ok: false;
  retryable: boolean;
  holdEndsAt?: Date;
  message: string;
};

export type CompleteFullAccountRecoveryResult =
  | { ok: true; operationId: string; userId: string }
  | CompletionFailure;

function withMilestone(
  operation: FullAccountRecoveryOperation,
  field:
    | "passwordUpdatedAt"
    | "twoFactorDisabledAt"
    | "completionSessionsRevokedAt"
    | "completionChallengesInvalidatedAt"
    | "completionNotificationEnqueuedAt"
    | "completionAuditFinalizedAt",
  now: Date,
) {
  return { ...operation, [field]: now };
}

export class CompleteFullAccountRecoveryService {
  constructor(
    private readonly repository = new PrismaAccountRecoveryRepository(),
    private readonly passwords = new BetterAuthPasswordGateway(),
    private readonly twoFactor = new BetterAuthTwoFactorGateway(),
    private readonly audit = new PrismaAuditRepository(),
    private readonly passwordPolicy = new PasswordPolicy(),
  ) {}

  async execute(
    rawProof: string,
    newPassword: string,
    now = new Date(),
  ): Promise<CompleteFullAccountRecoveryResult> {
    const policy = await this.passwordPolicy.evaluate(newPassword);
    if (!policy.accepted) {
      await this.recordFailure(now, "password_policy");
      return {
        ok: false,
        retryable: false,
        message: ACCOUNT_RECOVERY_GENERIC_ERROR,
      };
    }

    let claim;
    try {
      claim = await this.repository.claimOrResumeCompletion(
        rawProof,
        newPassword,
        now,
      );
    } catch {
      await this.recordFailure(now, "completion_claim_unavailable");
      return this.retryableFailure;
    }
    if (claim.status === "hold") {
      return {
        ok: false,
        retryable: false,
        holdEndsAt: claim.holdEndsAt,
        message: "The 24-hour security hold is still active.",
      };
    }
    if (claim.status === "busy") return this.retryableFailure;
    if (claim.status !== "acquired") {
      await this.recordFailure(now, `completion_${claim.status}`);
      return {
        ok: false,
        retryable: false,
        message: ACCOUNT_RECOVERY_GENERIC_ERROR,
      };
    }

    let operation = claim.operation;
    const owner = claim.executionOwner;
    if (!operation.passwordUpdatedAt) {
      try {
        await this.passwords.updatePassword(operation.userId, newPassword);
        await this.repository.markPasswordUpdated(operation.id, owner, now);
        operation = withMilestone(operation, "passwordUpdatedAt", now);
      } catch {
        return this.failClosed(
          operation.id,
          owner,
          "PASSWORD_UPDATE_FAILED",
          now,
        );
      }
    }
    if (!operation.twoFactorDisabledAt) {
      try {
        await this.twoFactor.disableForAccountRecovery(operation.userId);
        await this.repository.markTwoFactorDisabled(operation.id, owner, now);
        operation = withMilestone(operation, "twoFactorDisabledAt", now);
      } catch {
        return this.failClosed(
          operation.id,
          owner,
          "TWO_FACTOR_DISABLE_FAILED",
          now,
        );
      }
    }
    if (!operation.completionSessionsRevokedAt) {
      try {
        await this.passwords.revokeAllSessions(operation.userId);
        await this.repository.markCompletionSessionsRevoked(
          operation.id,
          owner,
          now,
        );
        operation = withMilestone(
          operation,
          "completionSessionsRevokedAt",
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
    if (!operation.completionChallengesInvalidatedAt) {
      try {
        await this.repository.invalidateCompletionChallenges(
          operation,
          owner,
          now,
        );
        operation = withMilestone(
          operation,
          "completionChallengesInvalidatedAt",
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
    if (!operation.completionNotificationEnqueuedAt) {
      try {
        await this.repository.enqueueCompletionNotification(
          operation,
          owner,
          now,
        );
        operation = withMilestone(
          operation,
          "completionNotificationEnqueuedAt",
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
    if (!operation.completionAuditFinalizedAt) {
      try {
        await this.repository.appendCompletionAudit(operation, owner, now);
        operation = withMilestone(operation, "completionAuditFinalizedAt", now);
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
      await this.repository.finalizeCompletion(operation.id, owner, now);
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
      operationId: operation.id,
      userId: operation.userId,
    };
  }

  private get retryableFailure(): CompletionFailure {
    return {
      ok: false,
      retryable: true,
      message: "Account recovery could not be completed. Please try again.",
    };
  }

  private async failClosed(
    operationId: string,
    owner: string,
    code: FullAccountRecoveryFailureCode,
    now: Date,
  ): Promise<CompletionFailure> {
    await this.repository
      .fail(operationId, owner, code, now)
      .catch(() => false);
    await this.recordFailure(now, code.toLowerCase());
    return this.retryableFailure;
  }

  private recordFailure(occurredAt: Date, reason: string) {
    return this.audit
      .append({
        occurredAt,
        actorType: "anonymous",
        action: "account_recovery.failed",
        targetType: "request",
        result: "FAILURE",
        correlationId: randomUUID(),
        context: { reason },
      })
      .catch(() => undefined);
  }
}
