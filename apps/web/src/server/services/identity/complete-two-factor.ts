import "server-only";
import { randomUUID } from "node:crypto";
import { BetterAuthSessionGateway } from "@/server/auth/identity/better-auth-session-gateway";
import { BetterAuthTwoFactorGateway } from "@/server/auth/identity/better-auth-two-factor-gateway";
import {
  decodePreAuth,
  providerCookieHeader,
} from "@/server/auth/identity/pre-auth-cookie";
import { PrismaPreAuthRepository } from "@/server/repositories/identity/prisma-pre-auth-repository";
import { PrismaSessionPolicyRepository } from "@/server/repositories/identity/prisma-session-policy-repository";
import { PrismaAuditRepository } from "@/server/repositories/audit/prisma-audit-repository";
import { SessionService } from "./session-service";
export class CompleteTwoFactorService {
  constructor(
    private challenges = new PrismaPreAuthRepository(),
    private gateway = new BetterAuthSessionGateway(),
    private sessions = new PrismaSessionPolicyRepository(),
    private audit = new PrismaAuditRepository(),
    private backupGateway = new BetterAuthTwoFactorGateway(),
  ) {}
  async execute(
    cookie: string,
    code: string,
    headers: Headers,
    now = new Date(),
    factor: "totp" | "backup-code" = "totp",
  ) {
    const state = decodePreAuth(cookie);
    if (!state) return null;
    const claim = await this.challenges.claimAttempt(
      state.handle,
      state.binding,
      now,
    );
    if (!claim) return null;
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
      await this.record("FAILURE", claim.userId, now);
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
      return null;
    }
    await new SessionService(this.sessions).enforceCreated(claim.userId);
    await this.record("SUCCESS", claim.userId, now);
    return { sessionCookie: session };
  }
  private record(
    result: "SUCCESS" | "FAILURE",
    userId: string,
    occurredAt: Date,
  ) {
    return this.audit
      .append({
        occurredAt,
        actorType: "anonymous",
        action:
          result === "SUCCESS"
            ? "totp.challenge_succeeded"
            : "totp.challenge_failed",
        targetType: "two_factor",
        targetId: userId,
        result,
        correlationId: randomUUID(),
        context: { reason: result === "SUCCESS" ? "verified" : "rejected" },
      })
      .catch(() => undefined);
  }
}
