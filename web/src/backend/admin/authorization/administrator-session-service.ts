import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { PrismaAdminAuthorityRepository } from "@/backend/repositories/admin/prisma-admin-authority-repository";
import { AuditWriter } from "@/backend/admin/audit/audit-writer";

export class AdministratorSessionService {
  async designate(input: { userId: string; sessionId: string; now?: Date }) {
    const now = input.now ?? new Date();
    return prisma.$transaction(async (tx) => {
      const repository = new PrismaAdminAuthorityRepository(tx);
      const [grant, session] = await Promise.all([
        repository.activeGrantForUser(input.userId, now),
        repository.sessionForUser(input.sessionId, input.userId, now),
      ]);
      if (!grant || !session) throw new Error("ADMIN_AUTHORITY_UNAVAILABLE");
      const previousSessionId = grant.sessionPolicy?.designatedSessionId;
      if (previousSessionId && previousSessionId !== input.sessionId) {
        await tx.session.updateMany({
          where: { id: previousSessionId, revokedAt: null },
          data: {
            revokedAt: now,
            revocationReason: "administrator_session_replaced",
          },
        });
      }
      const policy = await tx.administratorSessionPolicy.upsert({
        where: { grantId: grant.id },
        create: {
          grantId: grant.id,
          designatedSessionId: input.sessionId,
          initialTwoFactorAt: now,
          latestTwoFactorProofAt: now,
          designationVersion: 1,
        },
        update: {
          designatedSessionId: input.sessionId,
          initialTwoFactorAt: now,
          latestTwoFactorProofAt: now,
          designationVersion: { increment: 1 },
        },
      });
      await new AuditWriter(tx).append({
        occurredAt: now,
        actorType: "user",
        actorUserId: input.userId,
        actorSessionId: input.sessionId,
        action: "admin.session_designated",
        targetType: "administrator_session_policy",
        targetId: grant.id,
        result: "SUCCESS",
        correlationId: randomUUID(),
        context: {
          sessionsRevoked: Boolean(
            previousSessionId && previousSessionId !== input.sessionId,
          ),
        },
      });
      return policy;
    });
  }

  async stepUp(input: {
    grantId: string;
    sessionId: string;
    userId: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const changed = await prisma.administratorSessionPolicy.updateMany({
      where: { grantId: input.grantId, designatedSessionId: input.sessionId },
      data: { latestTwoFactorProofAt: now },
    });
    if (changed.count !== 1) throw new Error("ADMIN_AUTHORITY_UNAVAILABLE");
    await prisma.auditEvent.create({
      data: {
        occurredAt: now,
        actorType: "user",
        actorUserId: input.userId,
        actorSessionId: input.sessionId,
        action: "admin.step_up_completed",
        targetType: "administrator_session_policy",
        targetId: input.grantId,
        result: "SUCCESS",
        correlationId: randomUUID(),
        context: { reason: "sensitive_action_proof" },
      },
    });
  }
}
