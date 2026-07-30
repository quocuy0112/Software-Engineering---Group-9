import { describe, expect, it, vi } from "vitest";
import { LoginWithPasswordService } from "@/backend/services/identity/login-with-password";
import { RegisterAccountService } from "@/backend/services/identity/register-account";
import { VerifyEmailService } from "@/backend/services/identity/verify-email";
import { CompleteTwoFactorService } from "@/backend/services/two-factor/complete-two-factor";
import { EnrollTotpService } from "@/backend/services/profile/enroll-totp";
import { RegenerateBackupCodesService } from "@/backend/services/profile/regenerate-backup-codes";
import { DisableTwoFactorService } from "@/backend/services/two-factor/disable-two-factor";
import { ResetPasswordService } from "@/backend/services/recovery/reset-password";
import { SessionService } from "@/backend/services/session/session-service";
import { RevokeSessionService } from "@/backend/services/session/revoke-session";

function auditSpy() {
  return { append: vi.fn().mockResolvedValue("audit-id") };
}

const denied = {
  allowed: false,
  limit: 1,
  remaining: 0,
  retryAfterSeconds: 30,
};

describe("authentication audit integration", () => {
  it("records registration, verification, and login denial intents", async () => {
    const audit = auditSpy();
    const policy = {
      evaluate: vi.fn().mockResolvedValue({
        accepted: false,
        code: "PASSWORD_POLICY",
        message: "safe",
      }),
    };
    await new RegisterAccountService(
      undefined,
      undefined,
      policy as never,
      undefined,
      undefined,
      audit as never,
    ).execute(
      { name: "Test", email: "audit@example.test", password: "safe", passwordConfirmation: "safe" },
      { subject: "audit-test" },
    );
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "registration.rejected", result: "DENIED" }),
    );

    const verificationAudit = auditSpy();
    const verifier = new VerifyEmailService(
      { consume: vi.fn().mockResolvedValue("expired") } as never,
      undefined,
      verificationAudit as never,
    );
    await verifier.execute("opaque-test-value");
    expect(verificationAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "verification.failed", result: "FAILURE" }),
    );

    const loginAudit = auditSpy();
    const login = new LoginWithPasswordService(
      undefined,
      undefined,
      { consume: vi.fn().mockResolvedValue(denied) } as never,
      loginAudit as never,
      undefined,
    );
    await login.execute(
      { email: "audit@example.test", password: "not-used" },
      { headers: new Headers(), subject: "audit-login" },
    );
    expect(loginAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "rate_limit.denied", result: "DENIED" }),
    );
  });

  it("records second-factor and management failures without secret fields", async () => {
    const challengeAudit = auditSpy();
    await new CompleteTwoFactorService(
      undefined,
      undefined,
      undefined,
      challengeAudit as never,
    ).execute("invalid-cookie", "not-used", new Headers(), new Date(), "backup-code");
    expect(challengeAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "backup_code.consumed", result: "FAILURE" }),
    );

    const enrollmentAudit = auditSpy();
    await new EnrollTotpService({
      recentAuth: { execute: vi.fn().mockResolvedValue({ ok: false, status: 401 }) } as never,
      audit: enrollmentAudit as never,
    }).start("not-used", { headers: new Headers(), subject: "enrollment-audit" });
    expect(enrollmentAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "totp.enrollment_started", result: "FAILURE" }),
    );

    const regenerationAudit = auditSpy();
    await new RegenerateBackupCodesService(
      undefined,
      { execute: vi.fn().mockResolvedValue({ ok: false, status: 401 }) } as never,
      regenerationAudit as never,
    ).execute("not-used", "not-used", { headers: new Headers(), subject: "regeneration-audit" });
    expect(regenerationAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "backup_codes.regenerated", result: "FAILURE" }),
    );

    const disableAudit = auditSpy();
    await new DisableTwoFactorService(
      undefined,
      { execute: vi.fn().mockResolvedValue({ ok: false, status: 401 }) } as never,
      disableAudit as never,
    ).execute("not-used", "not-used", { headers: new Headers(), subject: "disable-audit" });
    expect(disableAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "totp.disabled", result: "FAILURE" }),
    );
  });

  it("records reset and session revocation intents without raw identifiers", async () => {
    const resetAudit = auditSpy();
    await new ResetPasswordService(
      undefined,
      undefined,
      resetAudit as never,
      { evaluate: vi.fn().mockResolvedValue({ accepted: false }) } as never,
    ).execute("opaque-reset-value", "not-used");
    expect(resetAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "password_reset.failed", result: "FAILURE" }),
    );

    const sessionAudit = auditSpy();
    const sessionService = new SessionService(
      { newest: vi.fn().mockResolvedValue({ id: "new" }), enforceCap: vi.fn().mockResolvedValue(["victim"]) } as never,
      sessionAudit as never,
    );
    await sessionService.enforceCreated("user-id");
    expect(sessionAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "session.revoked", targetId: null }),
    );
    await sessionService.recordLogout("user-id", "session-id");
    expect(sessionAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "logout.succeeded", targetId: null }),
    );

    const revokeAudit = auditSpy();
    await new RevokeSessionService(
      { tokenForOwned: vi.fn().mockResolvedValue(null) } as never,
      undefined,
      revokeAudit as never,
    ).execute("session-reference", "user-id", new Headers());
    expect(revokeAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "session.revoked", result: "FAILURE", targetId: null }),
    );
  });
});
