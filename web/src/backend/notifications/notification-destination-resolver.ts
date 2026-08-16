import "server-only";
import type { NotificationContextType, NotificationKind } from "@/shared/contracts/notifications";

export type NotificationRecipientAudience = "USER" | "ADMIN";

export type NotificationDestinationInput = {
  kind: NotificationKind;
  contextType: NotificationContextType | null;
  contextId: string | null;
  recipientAudience: NotificationRecipientAudience;
  occurrenceCount: number;
  lastOccurredAt: Date;
};

/**
 * Produces a transient navigation hint. It is deliberately not authorization:
 * the destination route must re-check membership and resource visibility.
 */
export function resolveNotificationHref(input: NotificationDestinationInput) {
  const { contextType, contextId, kind, recipientAudience } = input;
  if (!contextType || !contextId) return null;
  const id = encodeURIComponent(contextId);
  if (contextType === "ACCOUNT") return "/profile/security";
  if (contextType === "CONVERSATION" && recipientAudience === "USER")
    return `/messages?conversation=${id}`;
  if (contextType === "APPLICATION") {
    if (kind === "APPLICATION_RECEIVED")
      return `/recruiter?application=${id}`;
    return recipientAudience === "USER" ? `/jobs/applied/${id}` : null;
  }
  if (contextType === "JOB_POST_REVIEW")
    return recipientAudience === "ADMIN"
      ? `/admin/job-post-reviews/${id}`
      : `/recruiter/job-postings?review=${id}`;
  if (contextType === "MODERATION_REPORT")
    return recipientAudience === "ADMIN" ? `/admin/moderation/reports/${id}` : null;
  if (contextType === "VERIFICATION_REQUEST")
    return recipientAudience === "ADMIN" ? `/admin/verification-requests/${id}` : "/dashboard/employer-verification";
  return null;
}
