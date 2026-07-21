import { describe, expect, it, vi } from "vitest";
import { EnrollTotpService } from "@/server/services/identity/enroll-totp";
import type { TwoFactorGateway } from "@/server/auth/identity/better-auth-two-factor-gateway";
import type { RequireRecentAuthService, RecentAuthResult } from "@/server/services/identity/require-recent-auth";

const SECRET = "JBSWY3DPEHPK3PXP";
const VALID_URI = `otpauth://totp/SmartHire:demo@example.test?secret=${SECRET}&issuer=SmartHire&algorithm=SHA1&digits=6&period=30`;

function tenCodes(): string[] {
  return Array.from({ length: 10 }, (_, index) => `code${index}-abcde`);
}

// Minimal in-memory limiter/audit doubles so the unit test needs no database.
function fakeLimiter(allowed = true) {
  return {
    consume: vi.fn().mockResolvedValue({ allowed, limit: 5, remaining: allowed ? 4 : 0, retryAfterSeconds: allowed ? 0 : 42 }),
    subjectDigest: vi.fn((subject: string) => subject),
  } as never;
}

function fakeAudit() {
  const append = vi.fn().mockResolvedValue("audit-id");
  return { repo: { append } as never, append };
}

function recentAuth(result: RecentAuthResult): RequireRecentAuthService {
  return { execute: vi.fn().mockResolvedValue(result) } as unknown as RequireRecentAuthService;
}

function gateway(overrides: Partial<TwoFactorGateway> = {}): TwoFactorGateway {
  return {
    startEnrollment: vi.fn().mockResolvedValue({ otpauthUri: VALID_URI, backupCodes: tenCodes() }),
    verifyInitialTotp: vi.fn().mockResolvedValue(true),
    revealBackupCodes: vi.fn().mockResolvedValue(tenCodes()),
    ...overrides,
  };
}

const request = { headers: new Headers(), subject: "test-subject" };
const granted: RecentAuthResult = { ok: true, userId: "user-1", sessionId: "session-1" };

describe("EnrollTotpService.start", () => {
  it("renders a real QR and manual key after recent-auth passes", async () => {
    const { repo } = fakeAudit();
    const service = new EnrollTotpService({
      gateway: gateway(),
      recentAuth: recentAuth(granted),
      limiter: fakeLimiter(),
      audit: repo,
    });
    const result = await service.start("Correct Passphrase 2026!", request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.qrCodeDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(result.manualKey).toBe(SECRET);
    expect(result.issuer).toBe("SmartHire");
    expect(result.accountLabel).toBe("demo@example.test");
  });

  it("propagates the recent-auth denial without starting enrollment", async () => {
    const start = vi.fn();
    const service = new EnrollTotpService({
      gateway: gateway({ startEnrollment: start as never }),
      recentAuth: recentAuth({ ok: false, status: 401 }),
      limiter: fakeLimiter(),
      audit: fakeAudit().repo,
    });
    const result = await service.start("wrong password", request);
    expect(result).toEqual({ ok: false, status: 401, retryAfterSeconds: undefined });
    expect(start).not.toHaveBeenCalled();
  });

  it("returns a redacted 502 and does not leak the URI when the gateway fails", async () => {
    const { repo, append } = fakeAudit();
    const service = new EnrollTotpService({
      gateway: gateway({ startEnrollment: vi.fn().mockRejectedValue(new Error("boom")) as never }),
      recentAuth: recentAuth(granted),
      limiter: fakeLimiter(),
      audit: repo,
    });
    const result = await service.start("Correct Passphrase 2026!", request);
    expect(result).toEqual({ ok: false, status: 502 });
    const logged = JSON.stringify(append.mock.calls);
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain("otpauth://");
  });
});

describe("EnrollTotpService.verify", () => {
  it("throttles once the enrollment rate limit is exhausted", async () => {
    const verifyInitialTotp = vi.fn();
    const service = new EnrollTotpService({
      gateway: gateway({ verifyInitialTotp: verifyInitialTotp as never }),
      recentAuth: recentAuth(granted),
      limiter: fakeLimiter(false),
      audit: fakeAudit().repo,
    });
    const result = await service.verify("123456", request);
    expect(result).toEqual({ ok: false, status: 429, retryAfterSeconds: 42 });
    expect(verifyInitialTotp).not.toHaveBeenCalled();
  });
});
