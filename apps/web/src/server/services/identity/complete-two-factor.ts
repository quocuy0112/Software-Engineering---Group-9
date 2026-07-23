import "server-only";
import { randomUUID } from "node:crypto";
import {
  rateLimitPolicies,
  safeRetryMetadata,
} from "@/lib/rate-limit/policies";
import { BetterAuthSessionGateway } from "@/server/auth/identity/better-auth-session-gateway";
import { BetterAuthTwoFactorGateway } from "@/server/auth/identity/better-auth-two-factor-gateway";
import {
  decodePreAuth,
  providerCookieHeader,
} from "@/server/auth/identity/pre-auth-cookie";
import { PrismaPreAuthRepository } from "@/server/repositories/identity/prisma-pre-auth-repository";
import { PrismaSessionPolicyRepository } from "@/server/repositories/identity/prisma-session-policy-repository";
import { PrismaAuditRepository } from "@/server/repositories/audit/prisma-audit-repository";
import { PrismaRateLimitRepository } from "@/server/repositories/rate-limit/prisma-rate-limit-repository";
import { SessionService } from "./session-service";
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
    const forwarded = new Headers(headers);
    forwarded.set("cookie", providerCookieHeader(state.binding));
    let session: string | null = null;
    let response: Response | null = null;
    if (factor === "backup-code") {
      session = (
        await this.backupGateway
          .consumeBackupCode(forwarded, code)
          .catch(() => ({ sessionCookie: null }))
      ).sessionCookie;
    } else {
      response = await this.gateway
        .verifyTotp(code, forwarded)
        .catch(() => null);
      session =
        response?.headers
          .getSetCookie()
          .find((v) =>
            /^(smarthire\.session|__Host-smarthire\.session)=/.test(v),
          ) ?? null;
    }
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
