import "server-only";
import { randomUUID } from "node:crypto";
import {
  rateLimitPolicies,
  safeRetryMetadata,
} from "@/backend/security/rate-limit/policies";
import { BetterAuthSessionGateway } from "@/backend/auth/better-auth/better-auth-session-gateway";
import { BetterAuthTwoFactorGateway } from "@/backend/auth/better-auth/better-auth-two-factor-gateway";
import {
  decodePreAuth,
  providerCookieHeader,
} from "@/backend/auth/cookies/pre-auth-cookie";
import { PrismaPreAuthRepository } from "@/backend/repositories/identity/prisma-pre-auth-repository";
import { PrismaSessionPolicyRepository } from "@/backend/repositories/identity/prisma-session-policy-repository";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PrismaRateLimitRepository } from "@/backend/repositories/rate-limit/prisma-rate-limit-repository";
import { PrismaPasswordResetRepository } from "@/backend/repositories/identity/prisma-password-reset-repository";
import { PrismaAccountRecoveryRepository } from "@/backend/repositories/identity/prisma-account-recovery-repository";
import { SessionService } from "../session/session-service";
type CompletionResult =
  | { sessionCookie: string }
  | { rateLimited: true; retryAfterSeconds: number };
export class CompleteTwoFactorService {
  constructor(
    private challenges = new PrismaPreAuthRepository(),
    private gateway = new BetterAuthSessionGateway(),
    private sessions = new PrismaSessionPolicyRepository(),
    private audit = new PrismaAuditRepository(),
    private backupGateway = new BetterAuthTwoFactorGateway(),
    private limiter = new PrismaRateLimitRepository(),
    private resetOperations = new PrismaPasswordResetRepository(),
    private recoveryOperations = new PrismaAccountRecoveryRepository(),
  ) {}
  async execute(
    cookie: string,
    code: string,
    headers: Headers,
    now = new Date(),
    factor: "totp" | "backup-code" = "totp",
  ): Promise<CompletionResult | null> {
    const correlationId = randomUUID();
    const state = decodePreAuth(cookie);
    if (!state) {
      await this.record("FAILURE", undefined, now, factor, "invalid_cookie", correlationId);
      return null;
    }
    const challengeUserId = await this.challenges
      .userIdForHandle(state.handle, state.binding)
      .catch(() => null);
    if (
      challengeUserId &&
      (await this.recoveryOperations
        .hasBlockingForUser(challengeUserId)
        .catch(() => true))
    ) {
      await this.record(
        "FAILURE",
        challengeUserId,
        now,
        factor,
        "credential_recovery_incomplete",
        correlationId,
      );
      return null;
    }
    const decision = await this.limiter.consume({
      ...rateLimitPolicies.totpChallenge,
      subject: `challenge:${state.handle}`,
      now,
    });
    if (!decision.allowed) {
      await this.record("DENIED", undefined, now, factor, "throttled", correlationId);
      return {
        rateLimited: true,
        retryAfterSeconds: safeRetryMetadata(decision).retryAfterSeconds,
      };
    }
    const claim = await this.challenges.claimAttempt(
      state.handle,
      state.binding,
      now,
    );
    if (!claim) {
      await this.record("FAILURE", undefined, now, factor, "invalid_or_bound_challenge", correlationId);
      return null;
    }
    if (
      await this.recoveryOperations
        .hasBlockingForUser(claim.userId)
        .catch(() => true)
    ) {
      await this.record(
        "FAILURE",
        claim.userId,
        now,
        factor,
        "credential_recovery_incomplete",
        correlationId,
      );
      return null;
    }
    if (
      await this.resetOperations
        .hasIncompleteForUser(claim.userId)
        .catch(() => true)
    ) {
      await this.record(
        "FAILURE",
        claim.userId,
        now,
        factor,
        "password_reset_incomplete",
        correlationId,
      );
      return null;
    }
    const forwarded = new Headers(headers);
    forwarded.set("cookie", providerCookieHeader(state.binding));
    const session =
      factor === "backup-code"
        ? (
            await this.backupGateway
              .consumeBackupCode(forwarded, code)
              .catch(() => ({ sessionCookie: null }))
          ).sessionCookie
        : (
            await this.gateway
              .verifyTotp(code, forwarded)
              .catch(() => null)
          )?.headers
            .getSetCookie()
            .find((value) =>
              /^(smarthire\.session|__Host-smarthire\.session)=/.test(value),
            ) ?? null;
    if (!session) {
      await this.challenges.releaseFailed(claim.id, claim.claimTime);
      await this.record("FAILURE", claim.userId, now, factor, "factor_rejected", correlationId);
      return null;
    }
    const step =
      factor === "totp" ? BigInt(Math.floor(now.getTime() / 30000)) : undefined;
    if (
      !(await this.challenges.finalize(
        claim.id,
        claim.userId,
        claim.claimTime,
        step,
      ))
    ) {
      const h = new Headers({ cookie: session.split(";", 1)[0] });
      await this.gateway.signOut(h).catch(() => null);
      await this.record("FAILURE", claim.userId, now, factor, "challenge_finalize_failed", correlationId);
      return null;
    }
    await new SessionService(this.sessions).enforceCreated(claim.userId);
    await this.record("SUCCESS", claim.userId, now, factor, "verified", correlationId);
    return { sessionCookie: session };
  }
  private record(
    result: "SUCCESS" | "FAILURE" | "DENIED",
    userId: string | undefined,
    occurredAt: Date,
    factor: "totp" | "backup-code",
    reason: string,
    correlationId: string,
  ) {
    const action =
      factor === "backup-code"
        ? "backup_code.consumed"
        : result === "SUCCESS"
          ? "totp.challenge_succeeded"
          : "totp.challenge_failed";
    return this.audit
      .append({
        occurredAt,
        actorType: "anonymous",
        action,
        targetType: "two_factor",
        targetId: userId ?? null,
        result,
        correlationId,
        context: { reason },
      })
      .catch(() => undefined);
  }
}
