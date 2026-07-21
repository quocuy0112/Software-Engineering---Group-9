import "server-only";
import { randomUUID } from "node:crypto";
import { rateLimitPolicies, safeRetryMetadata } from "@/lib/rate-limit/policies";
import { PrismaRateLimitRepository } from "@/server/repositories/rate-limit/prisma-rate-limit-repository";
import { PrismaAuditRepository } from "@/server/repositories/audit/prisma-audit-repository";
import {
  BetterAuthTwoFactorGateway,
  type TwoFactorGateway,
} from "@/server/auth/identity/better-auth-two-factor-gateway";
import { RequireRecentAuthService } from "./require-recent-auth";
import { requireSession } from "@/server/auth/require-session";
import { buildTotpSetup, TotpQrError } from "@/server/auth/identity/totp-qr-code";

const BACKUP_CODE_COUNT = 10;

/** One-time enrollment setup material. Secret-bearing; never cached or persisted client-side. */
export type EnrollmentSetup = {
  ok: true;
  /** PNG data URL rendered locally from the otpauth URI. */
  qrCodeDataUrl: string;
  /** Base32 secret for manual entry when a QR scanner is unavailable. */
  manualKey: string;
  issuer: string;
  accountLabel: string;
};

export type EnrollmentDenied = { ok: false; status: 401 | 429 | 502; retryAfterSeconds?: number };
export type StartResult = EnrollmentSetup | EnrollmentDenied;

export type VerifyGranted = { ok: true; backupCodes: string[] };
export type VerifyResult = VerifyGranted | EnrollmentDenied;

type RequestContext = { headers: Headers; subject: string; now?: Date };

type Dependencies = {
  gateway?: TwoFactorGateway;
  recentAuth?: RequireRecentAuthService;
  limiter?: PrismaRateLimitRepository;
  audit?: PrismaAuditRepository;
};

/**
 * TOTP enrollment orchestrator. Better Auth exclusively owns the pending secret,
 * backup codes, verification, and enablement; this service layers recent-auth,
 * rate-limit, local QR rendering, and audit policy around those operations.
 *
 * Flow:
 *   authenticated ACTIVE user
 *   → recent-auth + current-password verification
 *   → Better Auth enrollment start (encrypted pending secret + backup codes)
 *   → local QR generation + manual setup key
 *   → six-digit initial TOTP verification
 *   → enable 2FA
 *   → return exactly ten backup codes once.
 *
 * No secret, otpauth URI, password, TOTP code, QR payload, or backup code is ever logged.
 */
export class EnrollTotpService {
  private readonly gateway: TwoFactorGateway;
  private readonly recentAuth: RequireRecentAuthService;
  private readonly limiter: PrismaRateLimitRepository;
  private readonly audit: PrismaAuditRepository;

  constructor(dependencies: Dependencies = {}) {
    this.gateway = dependencies.gateway ?? new BetterAuthTwoFactorGateway();
    this.recentAuth = dependencies.recentAuth ?? new RequireRecentAuthService();
    this.limiter = dependencies.limiter ?? new PrismaRateLimitRepository();
    this.audit = dependencies.audit ?? new PrismaAuditRepository();
  }

  /** Step 1: verify recent auth + password, start Better Auth enrollment, render local QR. */
  async start(currentPassword: string, request: RequestContext): Promise<StartResult> {
    const now = request.now ?? new Date();
    const correlationId = randomUUID();

    const recent = await this.recentAuth.execute(currentPassword, request);
    if (!recent.ok) {
      return { ok: false, status: recent.status, retryAfterSeconds: recent.retryAfterSeconds };
    }

    let setup: { qrCodeDataUrl: string; manualKey: string; issuer: string; accountLabel: string };
    try {
      const enrollment = await this.gateway.startEnrollment(request.headers, currentPassword);
      // Render the QR locally and derive the manual-entry fallback. buildTotpSetup
      // validates the otpauth URI and throws a redacted TotpQrError on malformed input.
      setup = await buildTotpSetup(enrollment.otpauthUri);
    } catch (error) {
      const reason = error instanceof TotpQrError ? "qr_render_failed" : "gateway_unavailable";
      await this.record("totp.enrollment_started", "FAILURE", correlationId, now, recent, reason);
      return { ok: false, status: 502 };
    }

    await this.record("totp.enrollment_started", "SUCCESS", correlationId, now, recent, "started");
    return {
      ok: true,
      qrCodeDataUrl: setup.qrCodeDataUrl,
      manualKey: setup.manualKey,
      issuer: setup.issuer,
      accountLabel: setup.accountLabel,
    };
  }

  /** Step 2: verify the six-digit code, enable 2FA, reveal the ten backup codes once. */
  async verify(code: string, request: RequestContext): Promise<VerifyResult> {
    const now = request.now ?? new Date();
    const correlationId = randomUUID();

    const decision = await this.limiter.consume({
      ...rateLimitPolicies.totpEnrollment,
      subject: `totp-enrollment-verify:${request.subject}`,
      now,
    });
    if (!decision.allowed) {
      await this.record("totp.enabled", "DENIED", correlationId, now, null, "throttled");
      return { ok: false, status: 429, retryAfterSeconds: safeRetryMetadata(decision).retryAfterSeconds };
    }

    // The verify step carries only the six-digit code (no password, per contract),
    // so re-establish the caller identity from the Better Auth session directly.
    const session = await requireSession(request.headers, now);
    if (!session) {
      await this.record("totp.enabled", "FAILURE", correlationId, now, null, "no_session");
      return { ok: false, status: 401 };
    }
    const actor = { userId: session.userId, sessionId: session.sessionId };

    const verified = await this.gateway.verifyInitialTotp(request.headers, code);
    if (!verified) {
      await this.record("totp.enabled", "FAILURE", correlationId, now, actor, "verification_failed");
      return { ok: false, status: 401 };
    }

    // 2FA is now enabled; reveal the codes Better Auth stored (encrypted) at enrollment
    // start, exactly once. Better Auth remains the sole owner and decryptor.
    const backupCodes = await this.revealBackupCodes(request.headers, session.userId);
    if (!backupCodes) {
      await this.record("totp.enabled", "FAILURE", correlationId, now, actor, "backup_reveal_failed");
      return { ok: false, status: 502 };
    }

    await this.record("totp.enabled", "SUCCESS", correlationId, now, actor, "enabled");
    return { ok: true, backupCodes };
  }

  /**
   * Reveals the backup codes Better Auth generated and stored (encrypted) at
   * enrollment start, decrypted through Better Auth. Returns null unless exactly
   * ten codes surface, so the caller can fail safely.
   */
  private async revealBackupCodes(headers: Headers, userId: string): Promise<string[] | null> {
    try {
      const codes = await this.gateway.revealBackupCodes(headers, userId);
      return codes.length === BACKUP_CODE_COUNT ? codes : null;
    } catch {
      return null;
    }
  }

  private record(
    action: "totp.enrollment_started" | "totp.enabled",
    result: "SUCCESS" | "FAILURE" | "DENIED",
    correlationId: string,
    occurredAt: Date,
    actor: { userId: string; sessionId: string } | null,
    reason: string,
  ) {
    return this.audit
      .append({
        occurredAt,
        actorType: actor ? "user" : "anonymous",
        actorUserId: actor?.userId ?? null,
        actorSessionId: actor?.sessionId ?? null,
        action,
        targetType: "two_factor",
        targetId: actor?.userId ?? null,
        result,
        correlationId,
        context: { stage: "enrollment", reason },
      })
      .catch(() => undefined);
  }
}
