import "server-only";
import { randomUUID } from "node:crypto";
import {
  BetterAuthTwoFactorGateway,
  type TwoFactorGateway,
} from "@/server/auth/identity/better-auth-two-factor-gateway";
import { RequireRecentAuthService } from "./require-recent-auth";
import { PrismaAuditRepository } from "@/server/repositories/audit/prisma-audit-repository";
export type DisableTwoFactorResult =
  | { ok: true }
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
    const valid = await this.gateway
      .verifyInitialTotp(request.headers, code)
      .catch(() => false);
    if (!valid) {
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
    const disabled = await this.gateway
      .disableTwoFactor(request.headers, currentPassword)
      .catch(() => false);
    if (!disabled) {
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
    return { ok: true };
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
