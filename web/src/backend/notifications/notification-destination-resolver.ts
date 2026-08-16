import "server-only";
import type { NotificationContextType, NotificationKind, NotificationRecipientRole } from "@/shared/contracts/notifications";

export type NotificationDestinationInput = {
  kind: NotificationKind;
  contextType: NotificationContextType | null;
  contextId: string | null;
  recipientRole: NotificationRecipientRole;
  occurrenceCount: number;
  lastOccurredAt: Date;
  jobId?: string | null;
  adminOrigin?: string;
};

const encode = (value: string) => encodeURIComponent(value);
const adminHref = (origin: string, route: string) => `${new URL(origin).origin}/#/${route}`;

/** A transient navigation hint, never an authorization decision. */
export function resolveNotificationHref(input: NotificationDestinationInput) {
  const { contextType, contextId, recipientRole, occurrenceCount } = input;
  if (!contextType || !contextId) return null;
  const id = encode(contextId);
  const grouped = occurrenceCount > 1;
  const since = encode(input.lastOccurredAt.toISOString());
  const adminOrigin = input.adminOrigin ?? process.env.ADMIN_ORIGIN ?? "http://console.admin.localhost:3001";
  if (contextType === "ACCOUNT") return "/profile/security";
  if (contextType === "CONVERSATION" && recipientRole !== "ADMIN")
    return grouped ? `/messages?filter=unread&since=${since}` : `/messages?conversation=${id}`;
  if (contextType === "APPLICATION") {
    if (recipientRole === "CANDIDATE") return grouped ? "/jobs/applied" : `/jobs/applied/${id}`;
    if (recipientRole === "RECRUITER" && input.jobId) {
      const jobId = encode(input.jobId);
      return grouped
        ? `/recruiter/candidates/${jobId}?status=new&since=${since}`
        : `/recruiter/candidates/${jobId}?application=${id}`;
    }
    return null;
  }
  if (contextType === "JOB_POST_REVIEW") {
    if (recipientRole === "ADMIN") return adminHref(adminOrigin, `job-post-reviews/${id}/show`);
    return recipientRole === "RECRUITER" ? `/recruiter/job-postings?review=${id}` : null;
  }
  if (contextType === "MODERATION_REPORT" && recipientRole === "ADMIN")
    return adminHref(adminOrigin, `moderation-reports/${id}/show`);
  if (contextType === "VERIFICATION_REQUEST")
    return recipientRole === "ADMIN"
      ? adminHref(adminOrigin, `verification-requests/${id}/show`)
      : recipientRole === "RECRUITER" ? "/dashboard/employer-verification" : null;
  return null;
}
