import "server-only";
import { prisma } from "@/backend/database/prisma";
import { SecurityNotificationDispatcher } from "@/backend/admin/notifications/security-notification-dispatcher";
import { alertOutstandingSecurityNotificationDead } from "@/backend/admin/notifications/security-notification-ops-alert";
export async function runSecurityNotificationCycle(now = new Date()) {
  const dispatcher = new SecurityNotificationDispatcher({
    async send(work) {
      const businessEventKey = work.idempotencyKey.startsWith(
        "security-notification:",
      )
        ? work.idempotencyKey.slice("security-notification:".length)
        : `legacy-work:${work.id}`;
      return prisma.emailOutbox.upsert({
        where: { idempotencyKey: `email-delivery:${businessEventKey}` },
        update: {},
        create: {
          kind: "SECURITY_ALERT",
          userId: work.targetUserId,
          recipientRef: work.targetUserId,
          templateVersion: "admin-security-v1",
          payloadRef: {
            ...(work.payloadRef as object),
            eventKind: work.kind,
          },
          idempotencyKey: `email-delivery:${businessEventKey}`,
          status: "PENDING",
          nextAttemptAt: now,
        },
      });
    },
  });
  const result = await dispatcher.dispatchDue(now);
  return {
    ...result,
    alerted: await alertOutstandingSecurityNotificationDead(),
  };
}
