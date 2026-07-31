import "server-only";
import type {
  PasswordChangeFailureCode,
  PasswordChangeOperation,
} from "@/backend/generated/prisma/client";
import { PasswordPolicy } from "@/backend/auth/policy/password-policy";
import { BetterAuthPasswordGateway } from "@/backend/auth/better-auth/better-auth-password-gateway";
import {
  PasswordChangeRepositoryIdempotencyConflictError,
  PasswordChangeRepositorySessionMismatchError,
  PrismaPasswordChangeOperationRepository,
} from "@/backend/repositories/account/prisma-password-change-operation-repository";
import { PrismaPasswordChangeAttemptRepository } from "@/backend/repositories/account/prisma-password-change-attempt-repository";
import {
  NetworkSourceProtector,
  type NetworkSourceInput,
} from "@/backend/security/network-source/network-source-protector";
import type {
  PasswordChangeOutcome,
  PasswordChangeRequest,
} from "@/shared/contracts/account/password-change";

const success: PasswordChangeOutcome = {
  status: "success",
  message: "Password changed. Other sessions were signed out.",
};

export class PasswordChangeValidationError extends Error {
  constructor(
    readonly code: string,
    readonly safeMessage: string,
  ) {
    super(code);
  }
}

export class CurrentPasswordInvalidError extends Error {
  constructor() {
    super("CURRENT_PASSWORD_INVALID");
  }
}

export class PasswordChangeLockedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("PASSWORD_CHANGE_LOCKED");
  }
}

export class PasswordChangeIdempotencyConflictError extends Error {
  constructor() {
    super("PASSWORD_CHANGE_IDEMPOTENCY_CONFLICT");
  }
}

export class PasswordChangeSessionMismatchError extends Error {
  constructor() {
    super("PASSWORD_CHANGE_SESSION_MISMATCH");
  }
}

export class PasswordChangeIncompleteError extends Error {
  constructor() {
    super("PASSWORD_CHANGE_INCOMPLETE");
  }
}

type OperationPort = Pick<
  PrismaPasswordChangeOperationRepository,
  | "find"
  | "matchesSubmission"
  | "createIntent"
  | "markPasswordUpdated"
  | "markOtherSessionsRevoked"
  | "verifyNoOtherUsableSessions"
  | "fail"
  | "recordRejected"
  | "finalize"
>;
type AttemptPort = Pick<
  PrismaPasswordChangeAttemptRepository,
  "status" | "recordWrongCurrent"
>;
type PasswordPort = Pick<
  BetterAuthPasswordGateway,
  | "classify"
  | "updatePassword"
  | "passwordEffective"
  | "assertAuthoritativeSession"
  | "revokeOtherSessions"
>;
type PolicyPort = Pick<PasswordPolicy, "evaluateChange">;
type NetworkPort = Pick<NetworkSourceProtector, "protect">;

export type ChangePasswordContext = {
  userId: string;
  sessionId: string;
  idempotencyKey: string;
  headers: Headers;
  correlationId: string;
  networkSource: NetworkSourceInput;
  now?: Date;
};

export class ChangePasswordService {
  private readonly operations: OperationPort;
  private readonly attempts: AttemptPort;
  private readonly passwordGateway: PasswordPort;
  private readonly passwordPolicy: PolicyPort;
  private readonly networkProtector: NetworkPort;

  constructor(
    dependencies: {
      operations?: OperationPort;
      attempts?: AttemptPort;
      passwordGateway?: PasswordPort;
      passwordPolicy?: PolicyPort;
      networkProtector?: NetworkPort;
    } = {},
  ) {
    this.operations =
      dependencies.operations ?? new PrismaPasswordChangeOperationRepository();
    this.attempts =
      dependencies.attempts ?? new PrismaPasswordChangeAttemptRepository();
    this.passwordGateway =
      dependencies.passwordGateway ?? new BetterAuthPasswordGateway();
    this.passwordPolicy = dependencies.passwordPolicy ?? new PasswordPolicy();
    this.networkProtector =
      dependencies.networkProtector ?? new NetworkSourceProtector();
  }

  async execute(
    submission: PasswordChangeRequest,
    context: ChangePasswordContext,
  ): Promise<PasswordChangeOutcome> {
    const now = context.now ?? new Date();
    let ipPrefixDigest: string;
    try {
      ipPrefixDigest = this.networkProtector.protect(
        context.networkSource,
      ).ipPrefixDigest;
    } catch {
      throw new PasswordChangeIncompleteError();
    }

    const policy = await this.passwordPolicy.evaluateChange(submission);
    if (!policy.accepted) {
      await this.recordRejected(
        context,
        ipPrefixDigest,
        policy.code.toLowerCase(),
        now,
      );
      throw new PasswordChangeValidationError(policy.code, policy.message);
    }

    let operation: PasswordChangeOperation | null;
    try {
      operation = await this.operations.find(
        context.userId,
        context.idempotencyKey,
      );
    } catch {
      throw new PasswordChangeIncompleteError();
    }

    if (operation) {
      if (!this.operations.matchesSubmission(operation, submission)) {
        throw new PasswordChangeIdempotencyConflictError();
      }
      if (
        operation.initiatingSessionId !== context.sessionId ||
        !(await this.authoritativeSessionMatches(context))
      ) {
        throw new PasswordChangeSessionMismatchError();
      }
      if (operation.status === "FINALIZED") return success;
    } else {
      const attempt = await this.attempts
        .status(context.userId, now)
        .catch(() => {
          throw new PasswordChangeIncompleteError();
        });
      if (attempt.locked) {
        throw new PasswordChangeLockedError(attempt.retryAfterSeconds ?? 1);
      }
      if (!(await this.authoritativeSessionMatches(context))) {
        throw new PasswordChangeSessionMismatchError();
      }
      let classification: {
        currentPasswordValid: boolean;
        newPasswordMatchesCurrent: boolean;
      };
      try {
        classification = await this.passwordGateway.classify(
          context.userId,
          submission.currentPassword,
          submission.newPassword,
        );
      } catch {
        throw new PasswordChangeIncompleteError();
      }
      if (!classification.currentPasswordValid) {
        await this.attempts.recordWrongCurrent({
          userId: context.userId,
          sessionId: context.sessionId,
          correlationId: context.correlationId,
          ipPrefixDigest,
          now,
        });
        throw new CurrentPasswordInvalidError();
      }
      if (classification.newPasswordMatchesCurrent) {
        const reuse = await this.passwordPolicy.evaluateChange({
          ...submission,
          newPasswordMatchesCurrent: true,
        });
        await this.recordRejected(
          context,
          ipPrefixDigest,
          "password_reuse",
          now,
        );
        throw new PasswordChangeValidationError(
          "PASSWORD_REUSE",
          reuse.accepted ? "Choose a different password." : reuse.message,
        );
      }
      try {
        operation = await this.operations.createIntent({
          userId: context.userId,
          sessionId: context.sessionId,
          idempotencyKey: context.idempotencyKey,
          submission,
          correlationId: context.correlationId,
          ipPrefixDigest,
          now,
        });
      } catch (error) {
        if (error instanceof PasswordChangeRepositoryIdempotencyConflictError) {
          throw new PasswordChangeIdempotencyConflictError();
        }
        if (error instanceof PasswordChangeRepositorySessionMismatchError) {
          throw new PasswordChangeSessionMismatchError();
        }
        throw new PasswordChangeIncompleteError();
      }
    }

    if (!operation.passwordUpdatedAt) {
      let effective: boolean;
      try {
        await this.passwordGateway.updatePassword(
          operation.userId,
          submission.newPassword,
        );
        effective = true;
      } catch {
        effective = await this.passwordGateway
          .passwordEffective(operation.userId, submission.newPassword)
          .catch(() => false);
      }
      if (!effective) {
        return this.failClosed(
          operation,
          "PASSWORD_UPDATE_FAILED",
          now,
          ipPrefixDigest,
        );
      }
      try {
        await this.operations.markPasswordUpdated(operation.id, now);
      } catch {
        return this.failClosed(
          operation,
          "PASSWORD_UPDATE_FAILED",
          now,
          ipPrefixDigest,
        );
      }
      operation = {
        ...operation,
        status: "PASSWORD_UPDATED",
        passwordUpdatedAt: now,
        failureCode: null,
        retryAt: null,
      };
    }

    if (!operation.otherSessionsRevokedAt) {
      if (!(await this.authoritativeSessionMatches(context))) {
        throw new PasswordChangeSessionMismatchError();
      }
      try {
        await this.passwordGateway.revokeOtherSessions(
          context.headers,
          operation.userId,
          operation.initiatingSessionId,
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "PASSWORD_CHANGE_SESSION_MISMATCH"
        ) {
          throw new PasswordChangeSessionMismatchError();
        }
        return this.failClosed(
          operation,
          "SESSION_REVOCATION_FAILED",
          now,
          ipPrefixDigest,
        );
      }
      const verified = await this.operations
        .verifyNoOtherUsableSessions(
          operation.userId,
          operation.initiatingSessionId,
          now,
        )
        .catch(() => false);
      if (!verified) {
        return this.failClosed(
          operation,
          "SESSION_VERIFICATION_FAILED",
          now,
          ipPrefixDigest,
        );
      }
      try {
        await this.operations.markOtherSessionsRevoked(operation.id, now);
      } catch {
        return this.failClosed(
          operation,
          "SESSION_VERIFICATION_FAILED",
          now,
          ipPrefixDigest,
        );
      }
      operation = {
        ...operation,
        status: "OTHER_SESSIONS_REVOKED",
        otherSessionsRevokedAt: now,
        failureCode: null,
        retryAt: null,
      };
    }

    try {
      await this.operations.finalize(operation, {
        sessionId: context.sessionId,
        correlationId: context.correlationId,
        ipPrefixDigest,
        now,
      });
    } catch (error) {
      return this.failClosed(
        operation,
        this.finalizationFailure(error),
        now,
        ipPrefixDigest,
      );
    }
    return success;
  }

  private async authoritativeSessionMatches(
    context: ChangePasswordContext,
  ): Promise<boolean> {
    try {
      await this.passwordGateway.assertAuthoritativeSession(
        context.headers,
        context.userId,
        context.sessionId,
      );
      return true;
    } catch {
      return false;
    }
  }

  private async recordRejected(
    context: ChangePasswordContext,
    ipPrefixDigest: string,
    reason: string,
    now: Date,
  ): Promise<void> {
    try {
      await this.operations.recordRejected({
        userId: context.userId,
        sessionId: context.sessionId,
        correlationId: context.correlationId,
        ipPrefixDigest,
        reason,
        now,
      });
    } catch {
      throw new PasswordChangeIncompleteError();
    }
  }

  private async failClosed(
    operation: PasswordChangeOperation,
    code: PasswordChangeFailureCode,
    now: Date,
    ipPrefixDigest: string,
  ): Promise<never> {
    await this.operations
      .fail(operation.id, code, now, ipPrefixDigest)
      .catch(() => undefined);
    throw new PasswordChangeIncompleteError();
  }

  private finalizationFailure(error: unknown): PasswordChangeFailureCode {
    const code = error instanceof Error ? error.message : "";
    if (/OUTBOX|NOTIFICATION/u.test(code)) {
      return "NOTIFICATION_ENQUEUE_FAILED";
    }
    if (/AUDIT/u.test(code)) return "AUDIT_FINALIZATION_FAILED";
    return "OPERATION_FINALIZATION_FAILED";
  }
}
