import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url), quiet: true });

const { prisma } = await import("../src/backend/database/prisma.ts");
const { createInAppNotification } =
  await import("../src/backend/notifications/notification-service.ts");
const { NotificationRecipientPolicy } =
  await import("../src/backend/notifications/notification-recipient-policy.ts");

const batchSize = 100;
let migratedRows = 0;
let createdRecipients = 0;

try {
  while (true) {
    const rows = await prisma.recruitmentNotificationWork.findMany({
      where: { status: { in: ["PENDING", "RETRYABLE"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: batchSize,
      include: {
        application: {
          select: {
            id: true,
            candidateUserId: true,
            stage: true,
            jobPosting: { select: { companyId: true } },
          },
        },
      },
    });
    if (!rows.length) break;
    for (const row of rows) {
      try {
        const count = await prisma.$transaction(async (tx) => {
          const recipients =
            row.audience === "CANDIDATE"
              ? [row.application.candidateUserId]
              : await new NotificationRecipientPolicy(
                  tx,
                ).activeCompanyRecipients(
                  row.application.jobPosting.companyId,
                );
          for (const recipientUserId of recipients) {
            await createInAppNotification(tx, {
              recipientUserId,
              kind: row.kind,
              deduplicationKey: `recruitment:${row.id}:${recipientUserId}`,
              correlationId: row.id,
              occurredAt: row.createdAt,
              contextType: "APPLICATION",
              contextId: row.application.id,
              variables:
                row.kind === "APPLICATION_STAGE_CHANGED"
                  ? { stage: row.application.stage }
                  : undefined,
            });
          }
          await tx.recruitmentNotificationWork.update({
            where: { id: row.id },
            data: { status: "SENT", safeErrorCode: null },
          });
          return recipients.length;
        });
        migratedRows += 1;
        createdRecipients += count;
      } catch {
        await prisma.recruitmentNotificationWork.update({
          where: { id: row.id },
          data: {
            status: "RETRYABLE",
            attempts: { increment: 1 },
            nextAttemptAt: new Date(Date.now() + 5 * 60 * 1000),
            safeErrorCode: "IN_APP_NOTIFICATION_MIGRATION_FAILED",
          },
        });
      }
    }
    if (rows.length < batchSize) break;
  }
  console.log(JSON.stringify({ migratedRows, createdRecipients }, null, 2));
} finally {
  await prisma.$disconnect();
}
