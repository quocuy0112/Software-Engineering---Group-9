import "server-only";
import { randomUUID } from "node:crypto";
import type { LoginData } from "@/features/identity/schemas/login";
import {
  rateLimitPolicies,
  safeRetryMetadata,
} from "@/lib/rate-limit/policies";
import { PrismaRateLimitRepository } from "@/server/repositories/rate-limit/prisma-rate-limit-repository";
import { PrismaAuditRepository } from "@/server/repositories/audit/prisma-audit-repository";
import { PrismaSessionPolicyRepository } from "@/server/repositories/identity/prisma-session-policy-repository";
import { PrismaPreAuthRepository } from "@/server/repositories/identity/prisma-pre-auth-repository";
import { PrismaPasswordResetRepository } from "@/server/repositories/identity/prisma-password-reset-repository";
import { PrismaAccountRecoveryRepository } from "@/server/repositories/identity/prisma-account-recovery-repository";
import { BetterAuthSessionGateway } from "@/server/auth/identity/better-auth-session-gateway";
import {
  encodePreAuth,
  setPreAuthCookie,
} from "@/server/auth/identity/pre-auth-cookie";
import { SessionService } from "./session-service";
import { noStoreHeaders } from "@/lib/security/response-headers";
export const GENERIC_LOGIN_ERROR = "Email or password is incorrect.";
const cookieValue = (line: string) =>
  line.slice(line.indexOf("=") + 1, line.indexOf(";"));
export class LoginWithPasswordService {
  constructor(
    private gateway = new BetterAuthSessionGateway(),
    private sessions = new PrismaSessionPolicyRepository(),
    private limiter = new PrismaRateLimitRepository(),
    private audit = new PrismaAuditRepository(),
    private challenges = new PrismaPreAuthRepository(),
    private resetOperations = new PrismaPasswordResetRepository(),
    private recoveryOperations = new PrismaAccountRecoveryRepository(),
  ) {}
  async execute(
    data: LoginData,
    request: { headers: Headers; subject: string; now?: Date },
  ) {
    const now = request.now ?? new Date(),
      cid = randomUUID();
    const d = await this.limiter.consume({
      ...rateLimitPolicies.login,
      subject: `${request.subject}:${data.email}`,
      now,
    });
    if (!d.allowed) {
      await this.record(
        "rate_limit.denied",
        "DENIED",
        cid,
        now,
        undefined,
        "login_throttled",
      );
      return Response.json(
        { message: GENERIC_LOGIN_ERROR },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            "Retry-After": String(safeRetryMetadata(d).retryAfterSeconds),
          },
        },
      );
    }
    const account = await this.sessions.accountByEmail(data.email);
    if (!account) {
      await this.record(
        "login.failed",
        "FAILURE",
        cid,
        now,
        undefined,
        "account_not_found",
      );
      return Response.json(
        { message: GENERIC_LOGIN_ERROR },
        { status: 401, headers: noStoreHeaders },
      );
    }
    if (account.state !== "ACTIVE") {
      await this.record(
        "login.failed",
        "FAILURE",
        cid,
        now,
        account.id,
        "account_inactive",
      );
      return Response.json(
        { message: GENERIC_LOGIN_ERROR },
        { status: 401, headers: noStoreHeaders },
      );
    }
    if (
      ((await this.resetOperations
        .hasIncompleteForUser(account.id)
        .catch(() => true)) ||
        (await this.recoveryOperations
          .hasBlockingForUser(account.id)
          .catch(() => true)))
    ) {
      await this.record(
        "login.failed",
        "FAILURE",
        cid,
        now,
        account.id,
        "credential_recovery_incomplete",
      );
      return Response.json(
        { message: GENERIC_LOGIN_ERROR },
        { status: 401, headers: noStoreHeaders },
      );
    }
    const upstream = await this.gateway
      .signIn(data.email, data.password, request.headers)
      .catch(() => null);
    if (upstream && !upstream.ok) {
      await this.record(
        "login.failed",
        "FAILURE",
        cid,
        now,
        account.id,
        "incorrect_password",
      );
      return Response.json(
        { message: GENERIC_LOGIN_ERROR },
        { status: 401, headers: noStoreHeaders },
      );
    }
    const cookies = upstream?.headers.getSetCookie() ?? [],
      session = cookies.find((v) =>
        /^(smarthire\.session|__Host-smarthire\.session)=/.test(v),
      ),
      provisional = cookies.find((v) =>
        /^(smarthire\.pre-auth|__Secure-smarthire\.pre-auth)=/.test(v),
      );
    if (!upstream || (!session && !provisional)) {
      await this.record("login.failed", "FAILURE", cid, now, account.id);
      return Response.json(
        { message: GENERIC_LOGIN_ERROR },
        { status: 401, headers: noStoreHeaders },
      );
    }
    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    if (account.twoFactorEnabled) {
      if (!provisional)
        return Response.json({ message: GENERIC_LOGIN_ERROR }, { status: 401 });
      const binding = cookieValue(provisional),
        challenge = await this.challenges.create(account.id, binding, now);
      headers.append(
        "Set-Cookie",
        setPreAuthCookie(encodePreAuth(challenge.token, binding)),
      );
      await this.record("login.succeeded", "SUCCESS", cid, now, account.id);
      return new Response(
        JSON.stringify({
          message: "Additional verification is required.",
          requiresTwoFactor: true,
        }),
        { status: 200, headers },
      );
    }
    if (!session)
      return Response.json(
        { message: GENERIC_LOGIN_ERROR },
        { status: 401, headers: noStoreHeaders },
      );
    for (const c of cookies) headers.append("Set-Cookie", c);
    await new SessionService(this.sessions).enforceCreated(account.id);
    await this.record("login.succeeded", "SUCCESS", cid, now, account.id);
    return new Response(
      JSON.stringify({ message: "Signed in.", requiresTwoFactor: false }),
      { status: 200, headers },
    );
  }
  private record(
    action: "login.succeeded" | "login.failed" | "rate_limit.denied",
    result: "SUCCESS" | "FAILURE" | "DENIED",
    correlationId: string,
    occurredAt: Date,
    targetId?: string,
    reason = result === "SUCCESS" ? "accepted" : "denied",
  ) {
    return this.audit
      .append({
        occurredAt,
        actorType: "anonymous",
        action,
        targetType: targetId ? "user_account" : "request",
        targetId,
        result,
        correlationId,
        context: { reason },
      })
      .catch(() => undefined);
  }
}
