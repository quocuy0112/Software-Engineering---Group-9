import "server-only";
import { randomUUID } from "node:crypto";
import type { FullAccountRecoveryOperation } from "@/backend/generated/prisma/client";
import { ACCOUNT_RECOVERY_GENERIC_ERROR } from "@/shared/contracts/identity/password-recovery";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { BetterAuthPasswordGateway } from "@/backend/auth/better-auth/better-auth-password-gateway";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PrismaAccountRecoveryRepository } from "@/backend/repositories/identity/prisma-account-recovery-repository";

type ConfirmationFailure = {
  ok: false;
  retryable: boolean;
  message: string;
};

export type ConfirmFullAccountRecoveryResult =
  | { ok: true; operationId: string; holdEndsAt: Date }
  | ConfirmationFailure;

function withMilestone(
  operation: FullAccountRecoveryOperation,
  field: "holdSessionsRevokedAt" | "holdChallengesInvalidatedAt",
  now: Date,
) {
  return { ...operation, [field]: now };
}

export class ConfirmFullAccountRecoveryService {
  constructor(
    private readonly repository = new PrismaAccountRecoveryRepository(),
    private readonly sessions = new BetterAuthPasswordGateway(),
    private readonly protector = new TokenProtector(),
    private readonly audit = new PrismaAuditRepository(),
  ) {}

  async execute(
    rawProof: string,
    now = new Date(),
  ): Promise<ConfirmFullAccountRecoveryResult> {
    let claim;
    try {
      claim = await this.repository.claimOrResumeConfirmation({
        rawProof,
        completionProof: this.protector.generate(),
        cancellationProof: this.protector.generate(),
        now,
      });
    } catch {
      await this.recordFailure(now, "confirmation_claim_unavailable");
      return this.retryableFailure;
    }
    if (claim.status === "busy") return this.retryableFailure;
    if (claim.status !== "acquired") {
      await this.recordFailure(now, `confirmation_${claim.status}`);
      return {
        ok: false,
        retryable: false,
        message: ACCOUNT_RECOVERY_GENERIC_ERROR,
      };
    }

    let operation = claim.operation;
    const owner = claim.executionOwner;
    if (!operation.holdSessionsRevokedAt) {
      try {
        await this.sessions.revokeAllSessions(operation.userId);
        await this.repository.markHoldSessionsRevoked(operation.id, owner, now);
        operation = withMilestone(operation, "holdSessionsRevokedAt", now);
      } catch {
        return this.failClosed(
          operation.id,
          owner,
          "HOLD_SESSION_REVOCATION_FAILED",
          now,
        );
      }
    }
    if (!operation.holdChallengesInvalidatedAt) {
      try {
        await this.repository.invalidateHoldChallenges(operation, owner, now);
        operation = withMilestone(
          operation,
          "holdChallengesInvalidatedAt",
          now,
        );
      } catch {
        return this.failClosed(
          operation.id,
          owner,
          "HOLD_CHALLENGE_INVALIDATION_FAILED",
          now,
        );
      }
    }
    try {
      await this.repository.finalizeHold(operation, owner, now);
    } catch {
      return this.failClosed(
        operation.id,
        owner,
        "HOLD_NOTIFICATION_ENQUEUE_FAILED",
        now,
      );
    }
    return {
      ok: true,
      operationId: operation.id,
      holdEndsAt: operation.holdEndsAt,
    };
  }

  private get retryableFailure(): ConfirmationFailure {
    return {
      ok: false,
      retryable: true,
      message: "Account recovery could not be started. Please try again.",
    };
  }

  private async failClosed(
    operationId: string,
    owner: string,
    failureCode:
      | "HOLD_SESSION_REVOCATION_FAILED"
      | "HOLD_CHALLENGE_INVALIDATION_FAILED"
      | "HOLD_NOTIFICATION_ENQUEUE_FAILED",
    now: Date,
  ): Promise<ConfirmationFailure> {
    await this.repository
      .fail(operationId, owner, failureCode, now)
      .catch(() => false);
    await this.recordFailure(now, failureCode.toLowerCase());
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
