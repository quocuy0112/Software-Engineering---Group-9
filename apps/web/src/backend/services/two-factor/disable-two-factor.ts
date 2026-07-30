import "server-only";
import { randomUUID } from "node:crypto";
import {
  BetterAuthTwoFactorGateway,
  type TwoFactorGateway,
} from "@/backend/auth/better-auth/better-auth-two-factor-gateway";
import { RequireRecentAuthService } from "../profile/require-recent-auth";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
export type DisableTwoFactorResult =
  | { ok: true; sessionCookie: string | null }
  | { ok: false; status: 401 | 429 | 502; retryAfterSeconds?: number };
export class DisableTwoFactorService {
  constructor(
    private gateway: TwoFactorGateway = new BetterAuthTwoFactorGateway(),
    private recent = new RequireRecentAuthService(),
    private audit = new PrismaAuditRepository(),
  ) {}
  async execute(
    currentPassword: string,
    code: string,
    request: { headers: Headers; subject: string; now?: Date },
  ): Promise<DisableTwoFactorResult> {
    const now = request.now ?? new Date(),
      cid = randomUUID(),
      recent = await this.recent.execute(currentPassword, request);
    if (!recent.ok) {
      await this.audit
        .append({
          occurredAt: now,
          actorType: "anonymous",
          action: "totp.disabled",
          targetType: "request",
          result: recent.status === 429 ? "DENIED" : "FAILURE",
          correlationId: cid,
          context: { reason: "recent_auth_failed" },
        })
        .catch(() => undefined);
      return recent;
    }
    const verification = await this.gateway
      .verifyInitialTotp(request.headers, code)
      .catch(() => ({ verified: false, sessionCookie: null }));
    if (!verification.verified) {
      await this.record(
        "FAILURE",
        recent.userId,
        recent.sessionId,
        cid,
        now,
        "invalid_code",
      );
      return { ok: false, status: 401 };
    }
    const disablement = await this.gateway
      .disableTwoFactor(request.headers, currentPassword)
      .catch(() => ({ disabled: false, sessionCookie: null }));
    if (!disablement.disabled) {
      await this.record(
        "FAILURE",
        recent.userId,
        recent.sessionId,
        cid,
        now,
        "provider_failure",
      );
      return { ok: false, status: 502 };
    }
    await this.record(
      "SUCCESS",
      recent.userId,
      recent.sessionId,
      cid,
      now,
      "disabled",
    );
    return { ok: true, sessionCookie: disablement.sessionCookie };
  }
  private record(
    result: "SUCCESS" | "FAILURE",
    userId: string,
    sessionId: string,
    cid: string,
    occurredAt: Date,
    reason: string,
  ) {
    return this.audit
      .append({
        occurredAt,
        actorType: "user",
        actorUserId: userId,
        actorSessionId: sessionId,
        action: "totp.disabled",
        targetType: "two_factor",
        targetId: userId,
        result,
        correlationId: cid,
        context: { reason },
      })
      .catch(() => undefined);
  }
}
