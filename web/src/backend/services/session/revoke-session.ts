import "server-only";
import { randomUUID } from "node:crypto";
import { BetterAuthSessionGateway } from "@/backend/auth/better-auth/better-auth-session-gateway";
import { PrismaSessionPolicyRepository } from "@/backend/repositories/identity/prisma-session-policy-repository";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { enforceMessagingUserRevocation } from "@/backend/messaging/realtime/messaging-authority-enforcement";
export class RevokeSessionService {
  constructor(
    private readonly repository = new PrismaSessionPolicyRepository(),
    private readonly gateway = new BetterAuthSessionGateway(),
    private readonly audit = new PrismaAuditRepository(),
  ) {}
  async execute(reference: string, userId: string, headers: Headers) {
    const token = await this.repository.tokenForOwned(reference, userId);
    if (!token) {
      await this.audit
        .append({
          occurredAt: new Date(),
          actorType: "user",
          actorUserId: userId,
          action: "session.revoked",
          targetType: "session",
          targetId: null,
          result: "FAILURE",
          correlationId: randomUUID(),
          context: { reason: "not_owned" },
        })
        .catch(() => undefined);
      return;
    }
    try {
      await this.gateway.revoke(headers, token);
      await this.audit
        .append({
          occurredAt: new Date(),
          actorType: "user",
          actorUserId: userId,
          action: "session.revoked",
          targetType: "session",
          targetId: null,
          result: "SUCCESS",
          correlationId: randomUUID(),
          context: { reason: "user_requested" },
        })
        .catch(() => undefined);
      await enforceMessagingUserRevocation({
        userId,
        sessionIds: [reference],
        cause: "SESSION",
      }).catch(() => undefined);
    } catch {
      await this.audit
        .append({
          occurredAt: new Date(),
          actorType: "user",
          actorUserId: userId,
          action: "session.revoked",
          targetType: "session",
          targetId: null,
          result: "FAILURE",
          correlationId: randomUUID(),
          context: { reason: "provider_failure" },
        })
        .catch(() => undefined);
    }
  }
}
