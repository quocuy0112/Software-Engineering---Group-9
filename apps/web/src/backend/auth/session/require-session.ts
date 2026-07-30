import "server-only";
import { randomUUID } from "node:crypto";
import { BetterAuthSessionGateway } from "../better-auth/better-auth-session-gateway";
import { SessionService } from "@/backend/services/session/session-service";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PrismaAccountRecoveryRepository } from "@/backend/repositories/identity/prisma-account-recovery-repository";
export async function requireSession(headers: Headers, now = new Date()) {
  const gateway = new BetterAuthSessionGateway();
  const current = await gateway.current(headers);
  if (!current) return null;
  const valid = await new SessionService().validate(
    current.session.id,
    current.user.id,
    now,
  );
  if (!valid) {
    await gateway.signOut(headers).catch(() => undefined);
    await new PrismaAuditRepository()
      .append({
        occurredAt: now,
        actorType: "user",
        actorUserId: current.user.id,
        actorSessionId: current.session.id,
        action: "session.revoked",
        targetType: "session",
        targetId: null,
        result: "DENIED",
        correlationId: randomUUID(),
        context: { reason: "policy_enforcement" },
      })
      .catch(() => undefined);
    return null;
  }
  if (
    await new PrismaAccountRecoveryRepository()
      .hasBlockingForUser(current.user.id)
      .catch(() => true)
  ) {
    await gateway.signOut(headers).catch(() => undefined);
    return null;
  }
  return { userId: current.user.id, sessionId: current.session.id };
}
