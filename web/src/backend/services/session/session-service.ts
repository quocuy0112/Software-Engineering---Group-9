import "server-only";
import { randomUUID } from "node:crypto";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PrismaSessionPolicyRepository } from "@/backend/repositories/identity/prisma-session-policy-repository";
import { enforceMessagingUserRevocation } from "@/backend/messaging/realtime/messaging-authority-enforcement";
export class SessionService {
  constructor(
    private readonly repository = new PrismaSessionPolicyRepository(),
    private readonly audit = new PrismaAuditRepository(),
  ) {}
  async enforceCreated(userId: string) {
    const current = await this.repository.newest(userId);
    const victims = await this.repository.enforceCap(userId, current?.id);
    await Promise.all(
      victims.map(() =>
        this.audit
          .append({
            occurredAt: new Date(),
            actorType: "system",
            actorUserId: userId,
            action: "session.revoked",
            targetType: "session",
            targetId: null,
            result: "SUCCESS",
            correlationId: randomUUID(),
            context: { reason: "lru_cap" },
          })
          .catch(() => undefined),
      ),
    );
    if (victims.length > 0) {
      await enforceMessagingUserRevocation({
        userId,
        sessionIds: victims,
        cause: "SESSION",
      }).catch(() => undefined);
    }
    return victims;
  }
  recordLogout(userId: string, sessionId: string, occurredAt = new Date()) {
    return this.audit
      .append({
        occurredAt,
        actorType: "user",
        actorUserId: userId,
        actorSessionId: sessionId,
        action: "logout.succeeded",
        targetType: "session",
        targetId: null,
        result: "SUCCESS",
        correlationId: randomUUID(),
        context: { reason: "user_requested" },
      })
      .catch(() => undefined);
  }
  validate(id: string, userId: string, now?: Date) {
    return this.repository.validateAndTouch(id, userId, now);
  }
}
