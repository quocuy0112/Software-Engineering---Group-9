import "server-only";
import { randomUUID } from "node:crypto";
import {
  BetterAuthTwoFactorGateway,
  type TwoFactorGateway,
} from "@/server/auth/identity/better-auth-two-factor-gateway";
import { RequireRecentAuthService } from "./require-recent-auth";
import { PrismaAuditRepository } from "@/server/repositories/audit/prisma-audit-repository";
export type BackupRegenerationResult =
  | { ok: true; backupCodes: string[] }
  | { ok: false; status: 401 | 429 | 502; retryAfterSeconds?: number };
export class RegenerateBackupCodesService {
  constructor(
    private gateway: TwoFactorGateway = new BetterAuthTwoFactorGateway(),
    private recent = new RequireRecentAuthService(),
    private audit = new PrismaAuditRepository(),
  ) {}
  async execute(
    currentPassword: string,
    code: string,
    request: { headers: Headers; subject: string; now?: Date },
  ): Promise<BackupRegenerationResult> {
    const now = request.now ?? new Date(),
      cid = randomUUID(),
      recent = await this.recent.execute(currentPassword, request);
    if (!recent.ok) return recent;
    if (
      !(await this.gateway
        .verifyInitialTotp(request.headers, code)
        .catch(() => false))
    )
      return { ok: false, status: 401 };
    try {
      const codes = await this.gateway.regenerateBackupCodes(
        request.headers,
        currentPassword,
      );
      if (codes.length !== 10) throw new Error("INVALID_COUNT");
      await this.audit.append({
        occurredAt: now,
        actorType: "user",
        actorUserId: recent.userId,
        actorSessionId: recent.sessionId,
        action: "backup_codes.regenerated",
        targetType: "two_factor",
        targetId: recent.userId,
        result: "SUCCESS",
        correlationId: cid,
        context: { count: 10 },
      });
      return { ok: true, backupCodes: codes };
    } catch {
      await this.audit
        .append({
          occurredAt: now,
          actorType: "user",
          actorUserId: recent.userId,
          actorSessionId: recent.sessionId,
          action: "backup_codes.regenerated",
          targetType: "two_factor",
          targetId: recent.userId,
          result: "FAILURE",
          correlationId: cid,
          context: { reason: "provider_failure" },
        })
        .catch(() => undefined);
      return { ok: false, status: 502 };
    }
  }
}
