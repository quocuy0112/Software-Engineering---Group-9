import { prisma } from "@/backend/database/prisma";

export async function cleanupJobPostReviewNotifications(
  reviewVersionIds: readonly string[],
  recipientUserIds: readonly string[] = [],
) {
  const contexts = [...new Set(reviewVersionIds.filter(Boolean))];
  const recipients = [...new Set(recipientUserIds.filter(Boolean))];
  if (contexts.length === 0) return;

  await prisma.inAppNotification.deleteMany({
    where: {
      contextType: "JOB_POST_REVIEW",
      contextId: { in: contexts },
      ...(recipients.length > 0 ? { recipientUserId: { in: recipients } } : {}),
    },
  });
}
