import "server-only";
import { prisma } from "@/backend/database/prisma";
import { SecurityNotificationDispatcher } from "@/backend/admin/notifications/security-notification-dispatcher";
export async function runSecurityNotificationCycle(now = new Date()) {
  const dispatcher = new SecurityNotificationDispatcher({
    async send(work) {
      await prisma.emailOutbox.upsert({
        where: { idempotencyKey: `security-work:${work.id}` },
        update: {},
        create: {
          kind: "SECURITY_ALERT",
          userId: work.targetUserId,
          recipientRef: work.targetUserId,
          templateVersion: "admin-security-v1",
          payloadRef: work.payloadRef as object,
          idempotencyKey: `security-work:${work.id}`,
          status: "PENDING",
          nextAttemptAt: now,
        },
      });
    },
  });
  return { dispatched: await dispatcher.dispatchDue(now) };
}
