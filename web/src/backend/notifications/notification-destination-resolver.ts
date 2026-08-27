import "server-only";
import type {
  NotificationContextType,
  NotificationKind,
  NotificationRecipientRole,
} from "@/shared/contracts/notifications";

export type NotificationDestinationInput = {
  notificationId: string;
  kind: NotificationKind;
  contextType: NotificationContextType | null;
  contextId: string | null;
  recipientRole: NotificationRecipientRole;
  occurrenceCount: number;
  lastOccurredAt: Date;
  jobId?: string | null;
  threadId?: string | null;
  adminOrigin?: string;
};

const encode = (value: string) => encodeURIComponent(value);
const adminHref = (origin: string, route: string) =>
  `${new URL(origin).origin}/#/${route}`;

/** A transient navigation hint, never an authorization decision. */
export function resolveNotificationHref(input: NotificationDestinationInput) {
  const { contextType, contextId, recipientRole, occurrenceCount } = input;
  const adminOrigin =
    input.adminOrigin ??
    process.env.ADMIN_ORIGIN ??
    "http://console.admin.localhost:3001";
  const fallback =
    recipientRole === "ADMIN"
      ? adminHref(
          adminOrigin,
          `notifications?notification=${encode(input.notificationId)}`,
        )
      : `/notifications?notification=${encode(input.notificationId)}`;
  if (!contextType || !contextId) return fallback;
  const id = encode(contextId);
  const grouped = occurrenceCount > 1;
  const since = encode(input.lastOccurredAt.toISOString());
  if (contextType === "ACCOUNT") return "/profile/security";
  if (
    contextType === "MEMBERSHIP" &&
    input.kind === "TEAM_APPLICATION_RECEIVED" &&
    recipientRole === "RECRUITER"
  )
    return `/recruiter/company-settings/team/applications?companyId=${id}`;
  if (contextType === "MEMBERSHIP") return "/recruiter/company-settings/team";
  if (contextType === "COMPANY_INVITATION")
    return recipientRole === "CANDIDATE"
      ? `/recruiter/company-invitation?invitationId=${id}`
      : "/recruiter/company-settings/team";
  if (contextType === "CONVERSATION" && recipientRole !== "ADMIN")
    return grouped
      ? `/messages?filter=unread&since=${since}`
      : `/messages?conversation=${id}`;
  if (contextType === "APPLICATION") {
    if (input.kind === "MESSAGE_RECEIVED") {
      if (recipientRole === "CANDIDATE") return `/jobs/applied/${id}/messages`;
      if (recipientRole === "RECRUITER" && input.threadId)
        return `/recruiter/messages?thread=${encode(input.threadId)}`;
    }
    if (recipientRole === "CANDIDATE")
      return grouped ? "/jobs/applied" : `/jobs/applied/${id}`;
    if (recipientRole === "RECRUITER" && input.jobId) {
      const jobId = encode(input.jobId);
      return grouped
        ? `/recruiter/candidates/${jobId}?status=new&since=${since}`
        : `/recruiter/candidates/${jobId}?application=${id}`;
    }
    return fallback;
  }
  if (contextType === "JOB_POST_REVIEW") {
    if (recipientRole === "ADMIN")
      return adminHref(adminOrigin, `job-post-reviews/${id}/show`);
    return recipientRole === "RECRUITER"
      ? `/recruiter/job-postings?review=${id}`
      : fallback;
  }
  if (contextType === "MODERATION_REPORT")
    return recipientRole === "ADMIN"
      ? adminHref(adminOrigin, `moderation-reports/${id}/show`)
      : `/notifications?moderationReport=${id}`;
  if (contextType === "VERIFICATION_REQUEST")
    return recipientRole === "ADMIN"
      ? adminHref(adminOrigin, `verification-requests/${id}/show`)
      : recipientRole === "RECRUITER"
        ? "/dashboard/employer-verification"
        : fallback;
  if (contextType === "SUPPORT_CASE")
    return recipientRole === "ADMIN"
      ? adminHref(adminOrigin, `support-cases/${id}/show`)
      : `/support?case=${id}`;
  if (contextType === "CONNECTION_PROPOSAL")
    return `/connections?proposal=${id}`;
  if (contextType === "CONNECTION") return `/connections?connection=${id}`;
  if (contextType === "MESSAGING_REPORT")
    return recipientRole === "ADMIN"
      ? adminHref(adminOrigin, `messaging-reports/${id}/show`)
      : `/messages?report=${id}`;
  return fallback;
}
