import { describe, expect, it, vi } from "vitest";
import { ResetPasswordService } from "@/backend/services/recovery/reset-password";
import { CompleteTwoFactorService } from "@/backend/services/two-factor/complete-two-factor";
import { encodePreAuth } from "@/backend/auth/cookies/pre-auth-cookie";

const now = new Date("2026-07-23T10:00:00.000Z");

function operation(overrides: Record<string, unknown> = {}) {
  return {
    id: "operation-id",
    userId: "user-id",
    securityTokenId: "token-id",
    operationKey: "a".repeat(64),
    status: "CLAIMED",
    auditIntentKey: "password-reset-intent:operation-id",
    notificationIdempotencyKey: "password-changed:operation-id",
    notificationOutboxId: null,
    finalAuditId: null,
    passwordUpdatedAt: null,
    sessionsRevokedAt: null,
    challengesInvalidatedAt: null,
    notificationEnqueuedAt: null,
    auditFinalizedAt: null,
    failureCode: null,
    retryAt: null,
    executionOwner: "owner-id",
    leaseExpiresAt: new Date(now.getTime() + 60_000),
    finalizedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function repositoryMock(overrides: Record<string, unknown> = {}) {
  return {
    claimOrResume: vi.fn().mockResolvedValue({
      status: "acquired",
      operation: operation(),
      executionOwner: "owner-id",
      claimed: true,
    }),
    markPasswordUpdated: vi.fn().mockResolvedValue(undefined),
    markSessionsRevoked: vi.fn().mockResolvedValue(undefined),
    invalidateChallengesAndResetProofs: vi.fn().mockResolvedValue(undefined),
    enqueueNotification: vi.fn().mockResolvedValue("outbox-id"),
    appendFinalAudit: vi.fn().mockResolvedValue("audit-id"),
    finalize: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const acceptedPolicy = {
  evaluate: vi.fn().mockResolvedValue({ accepted: true }),
};
const quietAudit = { append: vi.fn().mockResolvedValue("audit-id") };

describe("reset password saga", () => {
  it.each(["invalid", "used", "expired"])(
    "maps %s token state generically",
    async (status) => {
      const repository = repositoryMock({
        claimOrResume: vi.fn().mockResolvedValue({ status }),
      });
      const service = new ResetPasswordService(
        repository as never,
        {} as never,
        quietAudit as never,
        acceptedPolicy as never,
      );
      await expect(
        service.execute("opaque", "correct horse 2026"),
      ).resolves.toMatchObject({
        ok: false,
        retryable: false,
        message: expect.stringContaining("invalid"),
      });
    },
  );

  it("rejects a compromised password before claiming the reset token", async () => {
    const repository = repositoryMock();
    const service = new ResetPasswordService(
      repository as never,
      {} as never,
      quietAudit as never,
    );
    await expect(
      service.execute("opaque", "qwerty123456"),
    ).resolves.toMatchObject({ ok: false, retryable: false });
    expect(repository.claimOrResume).not.toHaveBeenCalled();
  });

  it("executes every ordered milestone and never creates a session", async () => {
    const calls: string[] = [];
    const repository = repositoryMock({
      markPasswordUpdated: vi.fn(async () => calls.push("password_marked")),
      markSessionsRevoked: vi.fn(async () => calls.push("sessions_marked")),
      invalidateChallengesAndResetProofs: vi.fn(async () =>
        calls.push("challenges"),
      ),
      enqueueNotification: vi.fn(async () => calls.push("notification")),
      appendFinalAudit: vi.fn(async () => calls.push("final_audit")),
      finalize: vi.fn(async () => calls.push("finalized")),
    });
    const gateway = {
      updatePassword: vi.fn(async () => calls.push("password")),
      revokeAllSessions: vi.fn(async () => calls.push("sessions")),
    };
    const service = new ResetPasswordService(
      repository as never,
      gateway as never,
      quietAudit as never,
      acceptedPolicy as never,
    );
    await expect(
      service.execute("opaque", "correct horse 2026", now),
    ).resolves.toEqual({
      ok: true,
      userId: "user-id",
      operationId: "operation-id",
    });
    expect(calls).toEqual([
      "password",
      "password_marked",
      "sessions",
      "sessions_marked",
      "challenges",
      "notification",
      "final_audit",
      "finalized",
    ]);
    expect(gateway).not.toHaveProperty("createSession");
  });

  it("resumes after the first incomplete milestone without repeating password update", async () => {
    const repository = repositoryMock({
      claimOrResume: vi.fn().mockResolvedValue({
        status: "acquired",
        operation: operation({
          status: "FAILED_RETRYABLE",
          passwordUpdatedAt: now,
          failureCode: "SESSION_REVOCATION_FAILED",
          retryAt: now,
        }),
        executionOwner: "retry-owner",
        claimed: false,
      }),
    });
    const gateway = {
      updatePassword: vi.fn(),
      revokeAllSessions: vi.fn().mockResolvedValue(undefined),
    };
    const service = new ResetPasswordService(
      repository as never,
      gateway as never,
      quietAudit as never,
      acceptedPolicy as never,
    );
    await expect(
      service.execute("opaque", "correct horse 2026", now),
    ).resolves.toMatchObject({ ok: true });
    expect(gateway.updatePassword).not.toHaveBeenCalled();
    expect(gateway.revokeAllSessions).toHaveBeenCalledOnce();
  });

  it("persists an allowlisted retryable failure and never reports success", async () => {
    const repository = repositoryMock();
    const gateway = {
      updatePassword: vi.fn().mockResolvedValue(true),
      revokeAllSessions: vi.fn().mockRejectedValue(new Error("injected")),
    };
    const service = new ResetPasswordService(
      repository as never,
      gateway as never,
      quietAudit as never,
      acceptedPolicy as never,
    );
    await expect(
      service.execute("opaque", "correct horse 2026", now),
    ).resolves.toMatchObject({ ok: false, retryable: true });
    expect(repository.fail).toHaveBeenCalledWith(
      "operation-id",
      "owner-id",
      "SESSION_REVOCATION_FAILED",
      now,
    );
  });

  it("blocks second-factor completion while reset cleanup is unresolved", async () => {
    const backupGateway = { consumeBackupCode: vi.fn() };
    const result = await new CompleteTwoFactorService(
      {
        userIdForHandle: vi.fn().mockResolvedValue("user-id"),
        claimAttempt: vi.fn().mockResolvedValue({
          id: "challenge-id",
          userId: "user-id",
          claimTime: now,
        }),
      } as never,
      {} as never,
      {} as never,
      { append: vi.fn().mockResolvedValue("audit-id") } as never,
      backupGateway as never,
      { consume: vi.fn().mockResolvedValue({ allowed: true }) } as never,
      { hasIncompleteForUser: vi.fn().mockResolvedValue(true) } as never,
      { hasBlockingForUser: vi.fn().mockResolvedValue(false) } as never,
    ).execute(
      encodePreAuth("challenge-handle", "browser-binding"),
      "unused-backup-code",
      new Headers(),
      now,
      "backup-code",
    );
    expect(result).toBeNull();
    expect(backupGateway.consumeBackupCode).not.toHaveBeenCalled();
  });
});
