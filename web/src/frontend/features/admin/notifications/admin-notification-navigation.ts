import type { NotificationItem } from "@/shared/contracts/notifications";

export type AdminNotificationTarget = {
  resource: string;
  id: string;
};

export function adminNotificationTarget(
  notification: NotificationItem,
): AdminNotificationTarget | null {
  if (!notification.contextId) return null;
  const resources: Partial<
    Record<NonNullable<NotificationItem["contextType"]>, string>
  > = {
    ACCOUNT: "accounts",
    MEMBERSHIP: "company-memberships",
    VERIFICATION_REQUEST: "verification-requests",
    SUPPORT_CASE: "support-cases",
    MESSAGING_REPORT: "messaging-reports",
    MODERATION_REPORT: "moderation-reports",
    CONNECTION_PROPOSAL: "professional-connection-proposals",
    JOB_POST_REVIEW: "job-post-reviews",
  };
  const resource = notification.contextType
    ? resources[notification.contextType]
    : undefined;
  return resource ? { resource, id: notification.contextId } : null;
}
