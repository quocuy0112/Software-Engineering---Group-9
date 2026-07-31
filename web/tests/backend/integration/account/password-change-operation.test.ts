import { describe, expect, it, vi } from "vitest";
import type { PasswordChangeOperation } from "@/backend/generated/prisma/client";
import {
  ChangePasswordService,
  PasswordChangeIdempotencyConflictError,
  PasswordChangeIncompleteError,
  PasswordChangeSessionMismatchError,
} from "@/backend/services/account/change-password";

const now = new Date("2026-07-31T06:00:00.000Z");
const body = {
  currentPassword: "Current operation password 2026!",
  newPassword: "New operation password 2026!",
  newPasswordConfirmation: "New operation password 2026!",
};
const context = {
  userId: "operation-user",
  sessionId: "operation-session",
  idempotencyKey: "password_operation_key_0001",
  headers: new Headers({ cookie: "smarthire.session=opaque" }),
  correlationId: "password-operation-correlation",
  networkSource: { remoteAddress: "127.0.0.1" },
  now,
};

function operation(
  override: Partial<PasswordChangeOperation> = {},
): PasswordChangeOperation {
  return {
    id: "operation-id",
    userId: context.userId,
    idempotencyKey: context.idempotencyKey,
    submissionBindingDigest: "binding-digest",
    initiatingSessionId: context.sessionId,
    status: "INTENT_RECORDED",
    passwordUpdatedAt: null,
    otherSessionsRevokedAt: null,
    notificationIdempotencyKey: "password-change-notice:operation-id",
    notificationOutboxId: null,
    finalAuditId: null,
    failureCode: null,
    retryAt: null,
    finalizedAt: null,
    createdAt: now,
    updatedAt: now,
    ...override,
  };
}

function dependencies(existing: PasswordChangeOperation | null = null) {
  const operations = {
    find: vi.fn().mockResolvedValue(existing),
    matchesSubmission: vi.fn().mockReturnValue(true),
    createIntent: vi.fn().mockResolvedValue(operation()),
    markPasswordUpdated: vi.fn().mockResolvedValue(undefined),
    markOtherSessionsRevoked: vi.fn().mockResolvedValue(undefined),
    verifyNoOtherUsableSessions: vi.fn().mockResolvedValue(true),
    fail: vi.fn().mockResolvedValue(undefined),
    recordRejected: vi.fn().mockResolvedValue(undefined),
    finalize: vi.fn().mockResolvedValue(undefined),
  };
  const attempts = {
    status: vi.fn().mockResolvedValue({ locked: false, failureCount: 0 }),
    recordWrongCurrent: vi.fn(),
  };
  const passwordGateway = {
    classify: vi.fn().mockResolvedValue({
      currentPasswordValid: true,
      newPasswordMatchesCurrent: false,
    }),
    updatePassword: vi.fn().mockResolvedValue(true),
    passwordEffective: vi.fn().mockResolvedValue(false),
    assertAuthoritativeSession: vi.fn().mockResolvedValue({
      userId: context.userId,
      sessionId: context.sessionId,
    }),
    revokeOtherSessions: vi.fn().mockResolvedValue(undefined),
  };
  const passwordPolicy = {
    evaluateChange: vi.fn().mockResolvedValue({ accepted: true }),
  };
  const networkProtector = {
    protect: vi
      .fn()
      .mockReturnValue({ ipPrefixDigest: "protected-network-prefix" }),
  };
  return {
    operations,
    attempts,
    passwordGateway,
    passwordPolicy,
    networkProtector,
  };
}

describe("durable password-change operation", () => {
  it("rejects a changed idempotency binding before credential/session effects", async () => {
    const deps = dependencies(operation());
    deps.operations.matchesSubmission.mockReturnValue(false);
    await expect(
      new ChangePasswordService(deps).execute(body, context),
    ).rejects.toBeInstanceOf(PasswordChangeIdempotencyConflictError);
    expect(deps.passwordGateway.classify).not.toHaveBeenCalled();
    expect(deps.passwordGateway.updatePassword).not.toHaveBeenCalled();
  });

  it("persists a retryable password-write failure and does not claim success", async () => {
    const deps = dependencies();
    deps.passwordGateway.updatePassword.mockRejectedValueOnce(
      new Error("ambiguous provider write"),
    );
    deps.passwordGateway.passwordEffective.mockResolvedValueOnce(false);
    await expect(
      new ChangePasswordService(deps).execute(body, context),
    ).rejects.toBeInstanceOf(PasswordChangeIncompleteError);
    expect(deps.operations.createIntent).toHaveBeenCalledTimes(1);
    expect(deps.operations.fail).toHaveBeenCalledWith(
      "operation-id",
      "PASSWORD_UPDATE_FAILED",
      now,
      "protected-network-prefix",
    );
    expect(deps.passwordGateway.revokeOtherSessions).not.toHaveBeenCalled();
    expect(deps.operations.finalize).not.toHaveBeenCalled();
  });

  it("converges an ambiguous write, verifies revocation, then finalizes outbox/audit", async () => {
    const deps = dependencies();
    deps.passwordGateway.updatePassword.mockRejectedValueOnce(
      new Error("response lost"),
    );
    deps.passwordGateway.passwordEffective.mockResolvedValueOnce(true);
    await expect(
      new ChangePasswordService(deps).execute(body, context),
    ).resolves.toEqual({
      status: "success",
      message: expect.any(String),
    });
    expect(deps.operations.markPasswordUpdated).toHaveBeenCalledWith(
      "operation-id",
      now,
    );
    expect(
      deps.passwordGateway.assertAuthoritativeSession,
    ).toHaveBeenCalledWith(context.headers, context.userId, context.sessionId);
    expect(deps.passwordGateway.revokeOtherSessions).toHaveBeenCalled();
    expect(deps.operations.verifyNoOtherUsableSessions).toHaveBeenCalledWith(
      context.userId,
      context.sessionId,
      now,
    );
    expect(deps.operations.markOtherSessionsRevoked).toHaveBeenCalledWith(
      "operation-id",
      now,
    );
    expect(deps.operations.finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "operation-id",
        passwordUpdatedAt: now,
        otherSessionsRevokedAt: now,
      }),
      expect.objectContaining({
        ipPrefixDigest: "protected-network-prefix",
      }),
    );
  });

  it("resumes an existing operation despite a later unrelated attempt lock", async () => {
    const deps = dependencies(
      operation({
        status: "FAILED_RETRYABLE",
        passwordUpdatedAt: now,
        failureCode: "SESSION_REVOCATION_FAILED",
        retryAt: now,
      }),
    );
    deps.attempts.status.mockResolvedValue({
      locked: true,
      failureCount: 5,
      retryAfterSeconds: 900,
    });
    await expect(
      new ChangePasswordService(deps).execute(body, context),
    ).resolves.toMatchObject({ status: "success" });
    expect(deps.attempts.status).not.toHaveBeenCalled();
    expect(deps.passwordGateway.classify).not.toHaveBeenCalled();
    expect(deps.passwordGateway.updatePassword).not.toHaveBeenCalled();
    expect(deps.passwordGateway.revokeOtherSessions).toHaveBeenCalled();
  });

  it("refuses to resume under a different cookie-derived initiating session", async () => {
    const deps = dependencies(operation());
    deps.passwordGateway.assertAuthoritativeSession.mockRejectedValueOnce(
      new Error("PASSWORD_CHANGE_SESSION_MISMATCH"),
    );
    await expect(
      new ChangePasswordService(deps).execute(body, {
        ...context,
        sessionId: "different-session",
      }),
    ).rejects.toBeInstanceOf(PasswordChangeSessionMismatchError);
    expect(deps.passwordGateway.updatePassword).not.toHaveBeenCalled();
    expect(deps.operations.finalize).not.toHaveBeenCalled();
  });
});
