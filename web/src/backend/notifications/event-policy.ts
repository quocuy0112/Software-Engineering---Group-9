import "server-only";
import { z } from "zod";
import type {
  NotificationCategory,
  NotificationContextType,
  NotificationKind,
  NotificationSeverity,
  NotificationRecipientRole,
} from "@/shared/contracts/notifications";
import { notificationKindSchema } from "@/shared/contracts/notifications";

export const notificationVariablesSchema = z
  .object({
    companyName: z.string().trim().min(1).max(120).optional(),
    targetEmail: z.string().email().max(320).optional(),
    jobId: z.string().trim().min(1).max(128).optional(),
    threadId: z.string().trim().min(1).max(128).optional(),
    audience: z.enum(["USER", "ADMIN"]).optional(),
    recipientRole: z.enum(["CANDIDATE", "RECRUITER", "ADMIN"]).optional(),
    safeReason: z
      .enum(["POLICY_VIOLATION", "QUALITY_ISSUE", "DUPLICATE"])
      .optional(),
    stage: z.string().trim().min(1).max(64).optional(),
    state: z.string().trim().min(1).max(64).optional(),
    count: z.number().int().min(1).max(999).optional(),
  })
  .strict();

export type NotificationVariables = z.output<
  typeof notificationVariablesSchema
>;

export type NotificationEventInput = {
  recipientUserId: string;
  kind: NotificationKind;
  deduplicationKey: string;
  correlationId: string;
  occurredAt: Date;
  contextType?: NotificationContextType;
  contextId?: string;
  variables?: z.input<typeof notificationVariablesSchema>;
  language?: "VI" | "EN";
};

type Policy = {
  category: NotificationCategory;
  severity: NotificationSeverity;
  groupable?: boolean;
  title: { vi: string; en: string };
  summary: (locale: "vi" | "en", variables: SafeVariables) => string;
};

type SafeVariables = NotificationVariables;

const generic = (vi: string, en: string) => (locale: "vi" | "en") =>
  locale === "vi" ? vi : en;
const stateSummary = (
  vi: string,
  en: string,
  variables: SafeVariables,
  locale: "vi" | "en",
) => {
  const base = locale === "vi" ? vi : en;
  return variables.state ? `${base} (${variables.state})` : base;
};

const policies = {
  EMAIL_CHANGE_REQUESTED_ALERT: {
    category: "SECURITY",
    severity: "HIGH",
    title: { vi: "Yêu cầu đổi email", en: "Email change requested" },
    summary: generic(
      "Một yêu cầu đổi email đã được tạo cho tài khoản của bạn.",
      "An email change request was created for your account.",
    ),
  },
  PASSWORD_CHANGED: {
    category: "SECURITY",
    severity: "HIGH",
    title: { vi: "Mật khẩu đã thay đổi", en: "Password changed" },
    summary: generic(
      "Mật khẩu SmartHire của bạn đã được thay đổi.",
      "Your SmartHire password was changed.",
    ),
  },
  RECOVERY_PENDING: {
    category: "SECURITY",
    severity: "CRITICAL",
    title: {
      vi: "Khôi phục tài khoản đang chờ",
      en: "Account recovery pending",
    },
    summary: generic(
      "Yêu cầu khôi phục tài khoản đang trong thời gian bảo vệ.",
      "Your account recovery is in its security hold.",
    ),
  },
  RECOVERY_CANCELLED: {
    category: "SECURITY",
    severity: "HIGH",
    title: {
      vi: "Đã hủy khôi phục tài khoản",
      en: "Account recovery cancelled",
    },
    summary: generic(
      "Yêu cầu khôi phục tài khoản đã được hủy.",
      "Your account recovery request was cancelled.",
    ),
  },
  RECOVERY_COMPLETED: {
    category: "SECURITY",
    severity: "CRITICAL",
    title: {
      vi: "Khôi phục tài khoản hoàn tất",
      en: "Account recovery completed",
    },
    summary: generic(
      "Khôi phục tài khoản đã hoàn tất. Hãy đăng nhập lại an toàn.",
      "Account recovery completed. Sign in again securely.",
    ),
  },
  ACCOUNT_SUSPENDED: {
    category: "ACCOUNT",
    severity: "CRITICAL",
    title: { vi: "Tài khoản bị đình chỉ", en: "Account suspended" },
    summary: generic(
      "Quyền truy cập tài khoản SmartHire đã bị đình chỉ.",
      "Access to your SmartHire account was suspended.",
    ),
  },
  ACCOUNT_REINSTATED: {
    category: "ACCOUNT",
    severity: "HIGH",
    title: { vi: "Tài khoản đã khôi phục", en: "Account reinstated" },
    summary: generic(
      "Tài khoản SmartHire của bạn đã hoạt động trở lại.",
      "Your SmartHire account is active again.",
    ),
  },
  ALL_SESSIONS_REVOKED: {
    category: "SECURITY",
    severity: "CRITICAL",
    title: { vi: "Đã thu hồi mọi phiên", en: "All sessions revoked" },
    summary: generic(
      "Mọi phiên đăng nhập đã bị thu hồi. Hãy đăng nhập lại.",
      "All sign-in sessions were revoked. Sign in again.",
    ),
  },
  MEMBERSHIP_SUSPENDED: {
    category: "ACCOUNT",
    severity: "HIGH",
    title: { vi: "Quyền công ty bị đình chỉ", en: "Company access suspended" },
    summary: generic(
      "Quyền truy cập công ty của bạn đã bị đình chỉ.",
      "Your company access was suspended.",
    ),
  },
  MEMBERSHIP_RESTORED: {
    category: "ACCOUNT",
    severity: "HIGH",
    title: { vi: "Quyền công ty đã khôi phục", en: "Company access restored" },
    summary: generic(
      "Quyền truy cập công ty của bạn đã được khôi phục.",
      "Your company access was restored.",
    ),
  },
  MEMBERSHIP_REMOVED: {
    category: "ACCOUNT",
    severity: "HIGH",
    title: { vi: "Đã xóa quyền công ty", en: "Company access removed" },
    summary: generic(
      "Bạn đã bị xóa khỏi một công ty trên SmartHire.",
      "You were removed from a company on SmartHire.",
    ),
  },
  COMPANY_BANNED: {
    category: "ACCOUNT",
    severity: "CRITICAL",
    title: { vi: "Công ty bị cấm", en: "Company banned" },
    summary: (locale, variables) =>
      locale === "vi"
        ? `Quyền truy cập ${variables.companyName ?? "công ty"} đã bị vô hiệu hóa.`
        : `Access to ${variables.companyName ?? "your company"} was disabled.`,
  },
  COMPANY_UNBANNED: {
    category: "ACCOUNT",
    severity: "HIGH",
    title: { vi: "Công ty được mở cấm", en: "Company unbanned" },
    summary: (locale, variables) =>
      locale === "vi"
        ? `Quyền truy cập ${variables.companyName ?? "công ty"} đã được khôi phục.`
        : `Access to ${variables.companyName ?? "your company"} was restored.`,
  },
  COMPANY_INVITATION_RECEIVED: {
    category: "ACCOUNT",
    severity: "MEDIUM",
    title: { vi: "Lời mời tham gia công ty", en: "Company team invitation" },
    summary: (locale, variables) =>
      locale === "vi"
        ? `Bạn đã được mời tham gia đội ngũ${variables.companyName ? ` của ${variables.companyName}` : ""}. Mở thông báo hoặc kiểm tra email để chấp nhận lời mời.`
        : `You were invited to join${variables.companyName ? ` ${variables.companyName}` : " a company team"}. Open this notification or check your email to accept the invitation.`,
  },
  COMPANY_INVITATION_ACCEPTED: {
    category: "ACCOUNT",
    severity: "LOW",
    title: { vi: "Lời mời đã được chấp nhận", en: "Invitation accepted" },
    summary: (locale, variables) =>
      locale === "vi"
        ? `${variables.targetEmail ?? "Người được mời"} đã chấp nhận lời mời${variables.companyName ? ` tham gia ${variables.companyName}` : ""}.`
        : `${variables.targetEmail ?? "The invited account"} accepted the invitation${variables.companyName ? ` to join ${variables.companyName}` : ""}.`,
  },
  COMPANY_INVITATION_DECLINED: {
    category: "ACCOUNT",
    severity: "LOW",
    title: { vi: "Lời mời đã bị từ chối", en: "Invitation declined" },
    summary: (locale, variables) =>
      locale === "vi"
        ? `${variables.targetEmail ?? "Người được mời"} đã từ chối lời mời${variables.companyName ? ` tham gia ${variables.companyName}` : ""}.`
        : `${variables.targetEmail ?? "The invited account"} declined the invitation${variables.companyName ? ` to join ${variables.companyName}` : ""}.`,
  },
  APPLICATION_SUBMITTED: {
    category: "APPLICATION",
    severity: "LOW",
    title: { vi: "Đã nộp hồ sơ", en: "Application submitted" },
    summary: generic(
      "Hồ sơ ứng tuyển của bạn đã được ghi nhận.",
      "Your job application was received.",
    ),
  },
  APPLICATION_RECEIVED: {
    category: "APPLICATION",
    severity: "MEDIUM",
    title: { vi: "Có hồ sơ ứng tuyển mới", en: "New application received" },
    summary: generic(
      "Công ty của bạn vừa nhận một hồ sơ ứng tuyển mới.",
      "Your company received a new job application.",
    ),
  },
  TEAM_APPLICATION_RECEIVED: {
    category: "APPLICATION",
    severity: "MEDIUM",
    title: {
      vi: "Có hồ sơ ứng tuyển đội ngũ mới",
      en: "New team application received",
    },
    summary: (locale, variables) => {
      const role = variables.state === "HR_MANAGER" ? "HR Manager" : "Recruiter";
      return locale === "vi"
        ? `${variables.companyName ?? "Công ty của bạn"} vừa nhận hồ sơ ứng tuyển vị trí ${role} mới.`
        : `${variables.companyName ?? "Your company"} received a new ${role} team application.`;
    },
  },
  APPLICATION_STAGE_CHANGED: {
    category: "APPLICATION",
    severity: "MEDIUM",
    title: {
      vi: "Trạng thái ứng tuyển thay đổi",
      en: "Application status changed",
    },
    summary: (locale, variables) =>
      stateSummary(
        "Trạng thái hồ sơ ứng tuyển của bạn đã thay đổi.",
        "Your application status changed.",
        { ...variables, state: variables.stage ?? variables.state },
        locale,
      ),
  },
  VERIFICATION_RECEIVED: {
    category: "VERIFICATION",
    severity: "MEDIUM",
    title: { vi: "Đã nhận yêu cầu xác minh", en: "Verification received" },
    summary: (locale, variables) =>
      variables.audience === "ADMIN"
        ? "A new business verification request was submitted and is awaiting review."
        : generic(
            "Yêu cầu xác minh doanh nghiệp của bạn đã được ghi nhận.",
            "Your business verification request was received.",
          )(locale),
  },
  VERIFICATION_CHANGES_REQUESTED: {
    category: "VERIFICATION",
    severity: "HIGH",
    title: { vi: "Cần bổ sung xác minh", en: "Verification changes requested" },
    summary: generic(
      "Quản trị viên yêu cầu bạn bổ sung thông tin xác minh.",
      "An administrator requested changes to your verification.",
    ),
  },
  VERIFICATION_APPROVED: {
    category: "VERIFICATION",
    severity: "HIGH",
    title: { vi: "Xác minh đã được duyệt", en: "Verification approved" },
    summary: (locale, variables) =>
      locale === "vi"
        ? `${variables.companyName ?? "Doanh nghiệp"} đã được xác minh.`
        : `${variables.companyName ?? "Your company"} was verified.`,
  },
  VERIFICATION_REJECTED: {
    category: "VERIFICATION",
    severity: "HIGH",
    title: { vi: "Xác minh bị từ chối", en: "Verification rejected" },
    summary: generic(
      "Yêu cầu xác minh doanh nghiệp đã bị từ chối.",
      "Your business verification request was rejected.",
    ),
  },
  VERIFICATION_CANCELLED: {
    category: "VERIFICATION",
    severity: "MEDIUM",
    title: { vi: "Đã hủy xác minh", en: "Verification cancelled" },
    summary: generic(
      "Yêu cầu xác minh doanh nghiệp đã được hủy.",
      "Your business verification request was cancelled.",
    ),
  },
  VERIFICATION_DELAYED: {
    category: "VERIFICATION",
    severity: "MEDIUM",
    title: { vi: "Xác minh đang chậm", en: "Verification delayed" },
    summary: generic(
      "Quá trình xác minh cần thêm thời gian xử lý.",
      "Your verification needs additional processing time.",
    ),
  },
  VERIFICATION_EXPIRED: {
    category: "VERIFICATION",
    severity: "HIGH",
    title: { vi: "Xác minh đã hết hạn", en: "Verification expired" },
    summary: generic(
      "Yêu cầu xác minh đã hết hạn. Bạn có thể tạo yêu cầu mới.",
      "Your verification expired. You may submit a new request.",
    ),
  },
  SUPPORT_WAITING_FOR_USER: {
    category: "SUPPORT",
    severity: "MEDIUM",
    title: { vi: "Hỗ trợ cần phản hồi", en: "Support needs your reply" },
    summary: generic(
      "Yêu cầu hỗ trợ đang chờ phản hồi của bạn.",
      "Your support case is waiting for your reply.",
    ),
  },
  SUPPORT_RESOLVED: {
    category: "SUPPORT",
    severity: "LOW",
    title: { vi: "Hỗ trợ đã giải quyết", en: "Support case resolved" },
    summary: generic(
      "Yêu cầu hỗ trợ của bạn đã được giải quyết.",
      "Your support case was resolved.",
    ),
  },
  SUPPORT_CASE_RECEIVED: {
    category: "SUPPORT",
    severity: "MEDIUM",
    title: { vi: "Yêu cầu hỗ trợ mới", en: "New support case" },
    summary: generic(
      "Một yêu cầu hỗ trợ mới đang chờ quản trị viên xem xét.",
      "A new support case is awaiting administrator review.",
    ),
  },
  SUPPORT_REQUESTER_REPLIED: {
    category: "SUPPORT",
    severity: "HIGH",
    title: { vi: "Người yêu cầu đã phản hồi", en: "Support requester replied" },
    summary: generic(
      "Người yêu cầu đã phản hồi một trường hợp hỗ trợ được phân công.",
      "A requester replied to an assigned support case.",
    ),
  },
  SUPPORT_CASE_REOPENED: {
    category: "SUPPORT",
    severity: "HIGH",
    title: { vi: "Yêu cầu hỗ trợ được mở lại", en: "Support case reopened" },
    summary: generic(
      "Một yêu cầu hỗ trợ đã giải quyết vừa được người yêu cầu mở lại.",
      "A resolved support case was reopened by its requester.",
    ),
  },
  CONNECTION_PROPOSAL_CREATED: {
    category: "CONNECTION",
    severity: "MEDIUM",
    title: { vi: "Đề xuất kết nối mới", en: "New connection proposal" },
    summary: generic(
      "Bạn có một đề xuất kết nối nghề nghiệp mới.",
      "You have a new professional connection proposal.",
    ),
  },
  CONNECTION_PROPOSAL_UPDATED: {
    category: "CONNECTION",
    severity: "MEDIUM",
    title: {
      vi: "Đề xuất kết nối cập nhật",
      en: "Connection proposal updated",
    },
    summary: generic(
      "Một đề xuất kết nối nghề nghiệp đã thay đổi.",
      "A professional connection proposal changed.",
    ),
  },
  CONNECTION_PROPOSAL_INACTIVE: {
    category: "CONNECTION",
    severity: "LOW",
    title: {
      vi: "Đề xuất không còn hoạt động",
      en: "Connection proposal inactive",
    },
    summary: generic(
      "Một đề xuất kết nối không còn hoạt động.",
      "A connection proposal is no longer active.",
    ),
  },
  CONNECTION_ACCEPTED: {
    category: "CONNECTION",
    severity: "MEDIUM",
    title: { vi: "Kết nối đã được chấp nhận", en: "Connection accepted" },
    summary: generic(
      "Kết nối nghề nghiệp của bạn đã được thiết lập.",
      "Your professional connection was established.",
    ),
  },
  CONNECTION_REVOKED: {
    category: "CONNECTION",
    severity: "HIGH",
    title: { vi: "Kết nối đã bị thu hồi", en: "Connection revoked" },
    summary: generic(
      "Một kết nối nghề nghiệp đã bị thu hồi.",
      "A professional connection was revoked.",
    ),
  },
  MESSAGE_RECEIVED: {
    category: "MESSAGING",
    severity: "MEDIUM",
    groupable: true,
    title: { vi: "Tin nhắn mới", en: "New message" },
    summary: generic(
      "Bạn có tin nhắn chưa đọc trong cuộc trò chuyện này.",
      "You have unread messages in this conversation.",
    ),
  },
  MESSAGE_REPORT_RECEIVED: {
    category: "MODERATION",
    severity: "LOW",
    title: { vi: "Đã nhận báo cáo tin nhắn", en: "Message report received" },
    summary: generic(
      "Báo cáo của bạn đã được chuyển đến nhóm kiểm duyệt.",
      "Your report was sent to the moderation team.",
    ),
  },
  MESSAGE_REPORT_RESOLVED: {
    category: "MODERATION",
    severity: "MEDIUM",
    title: { vi: "Báo cáo đã xử lý", en: "Message report resolved" },
    summary: generic(
      "Quá trình xem xét báo cáo của bạn đã hoàn tất.",
      "Review of your message report is complete.",
    ),
  },
  MESSAGE_REPORT_DISMISSED: {
    category: "MODERATION",
    severity: "LOW",
    title: { vi: "Đã đóng báo cáo", en: "Message report closed" },
    summary: generic(
      "Báo cáo của bạn đã được xem xét và đóng.",
      "Your message report was reviewed and closed.",
    ),
  },
  MESSAGE_REPORT_RECEIVED_ADMIN: {
    category: "MODERATION",
    severity: "HIGH",
    title: { vi: "Báo cáo tin nhắn mới", en: "New message report" },
    summary: generic(
      "Một báo cáo tin nhắn mới đang chờ xem xét được bảo vệ.",
      "A new message report is awaiting protected review.",
    ),
  },
  MODERATION_REPORT_RECEIVED: {
    category: "MODERATION",
    severity: "LOW",
    title: { vi: "Đã nhận báo cáo", en: "Report received" },
    summary: generic(
      "Báo cáo của bạn đã được ghi nhận.",
      "Your report was received.",
    ),
  },
  MODERATION_REPORT_RESOLVED: {
    category: "MODERATION",
    severity: "MEDIUM",
    title: { vi: "Báo cáo đã giải quyết", en: "Report resolved" },
    summary: generic(
      "Quá trình xem xét báo cáo của bạn đã hoàn tất.",
      "Review of your report is complete.",
    ),
  },
  MODERATION_REPORT_DISMISSED: {
    category: "MODERATION",
    severity: "LOW",
    title: { vi: "Báo cáo đã đóng", en: "Report closed" },
    summary: generic(
      "Báo cáo của bạn đã được xem xét và đóng.",
      "Your report was reviewed and closed.",
    ),
  },
  MODERATION_REPORT_RECEIVED_ADMIN: {
    category: "MODERATION",
    severity: "HIGH",
    title: { vi: "Báo cáo kiểm duyệt mới", en: "New moderation report" },
    summary: generic(
      "Một báo cáo kiểm duyệt mới đang chờ xem xét.",
      "A new moderation report is awaiting review.",
    ),
  },
  VERIFICATION_REVIEW_OVERDUE: {
    category: "VERIFICATION",
    severity: "HIGH",
    title: { vi: "Xác minh cần chú ý", en: "Verification requires attention" },
    summary: generic(
      "Bằng chứng xác minh không thể xem trong thời hạn leo thang và cần được kiểm tra.",
      "Verification evidence has remained unavailable through the escalation threshold.",
    ),
  },
  DELIVERY_MANUAL_INTERVENTION_REQUIRED: {
    category: "SYSTEM",
    severity: "CRITICAL",
    title: {
      vi: "Gửi thông báo cần can thiệp",
      en: "Notification delivery needs intervention",
    },
    summary: generic(
      "Một thông báo bảo mật không thể gửi và cần quản trị viên can thiệp.",
      "A security notification could not be delivered and requires administrator intervention.",
    ),
  },
  JOB_POST_REVIEW_REQUESTED_ADMIN: {
    category: "MODERATION",
    severity: "MEDIUM",
    title: { vi: "Bài đăng cần xem xét", en: "Job post awaiting review" },
    summary: generic(
      "Một bài đăng tuyển dụng mới đang chờ quản trị viên xem xét.",
      "A new job post is awaiting administrator review.",
    ),
  },
  JOB_POST_APPROVED: {
    category: "MODERATION",
    severity: "LOW",
    title: { vi: "Bài đăng đã được duyệt", en: "Job post approved" },
    summary: generic(
      "Bài đăng tuyển dụng của bạn đã được duyệt.",
      "Your job post has been approved.",
    ),
  },
  JOB_POST_REJECTED: {
    category: "MODERATION",
    severity: "MEDIUM",
    title: { vi: "Bài đăng cần chỉnh sửa", en: "Job post needs revision" },
    summary: generic(
      "Bài đăng tuyển dụng của bạn cần được chỉnh sửa trước khi gửi lại.",
      "Your job post needs revision before it can be submitted again.",
    ),
  },
  JOB_POST_CHANGES_REQUESTED: {
    category: "MODERATION",
    severity: "MEDIUM",
    title: { vi: "Bài đăng cần chỉnh sửa", en: "Your post needs changes" },
    summary: generic(
      "Quản trị viên yêu cầu bạn chỉnh sửa bài đăng trước khi gửi lại.",
      "An administrator requested changes before this post can be submitted again.",
    ),
  },
} satisfies Record<NotificationKind, Policy>;

export type BuiltNotification = {
  kind: NotificationKind;
  category: NotificationCategory;
  severity: NotificationSeverity;
  audience: "USER" | "ADMIN";
  recipientRole?: NotificationRecipientRole;
  title: string;
  summary: string;
  href: string | null;
  contextType: NotificationContextType | null;
  contextId: string | null;
  deduplicationKey: string;
  correlationId: string;
  occurredAt: Date;
  groupable: boolean;
  /** Safe, non-sensitive values needed to render the notification in another locale. */
  variables?: NotificationVariables;
};

export function renderNotificationCopy(
  kind: NotificationKind,
  rawVariables: unknown,
  language: "VI" | "EN",
) {
  const parsed = notificationVariablesSchema.safeParse(rawVariables ?? {});
  const variables: SafeVariables = parsed.success ? parsed.data : {};
  const policy: Policy = policies[notificationKindSchema.parse(kind)];
  const locale = language === "EN" ? "en" : "vi";
  return {
    title: policy.title[locale].slice(0, 120),
    summary: policy.summary(locale, variables).slice(0, 500),
  };
}

export function buildNotification(
  input: NotificationEventInput,
  language: "VI" | "EN" = "VI",
): BuiltNotification {
  const kind = notificationKindSchema.parse(input.kind);
  const variables = notificationVariablesSchema.parse(input.variables ?? {});
  const policy: Policy = policies[kind];
  const contextType = input.contextType ?? null;
  const contextId = input.contextId?.trim() || null;
  if ((contextType === null) !== (contextId === null))
    throw new Error("NOTIFICATION_CONTEXT_INVALID");
  if (
    !input.recipientUserId ||
    !input.deduplicationKey ||
    input.deduplicationKey.length > 255 ||
    !input.correlationId ||
    input.correlationId.length > 128 ||
    (contextId?.length ?? 0) > 128 ||
    Number.isNaN(input.occurredAt.getTime())
  )
    throw new Error("NOTIFICATION_EVENT_INVALID");
  const { title, summary } = renderNotificationCopy(kind, variables, language);
  return {
    kind,
    category: policy.category,
    severity: policy.severity,
    audience: variables.audience === "ADMIN" ? "ADMIN" : "USER",
    recipientRole:
      variables.recipientRole ??
      (variables.audience === "ADMIN"
        ? "ADMIN"
        : kind === "APPLICATION_RECEIVED" || kind.startsWith("JOB_POST_")
          ? "RECRUITER"
          : "CANDIDATE"),
    title,
    summary,
    // Context is durable; href is resolved for the current recipient when served.
    href: null,
    contextType,
    contextId,
    deduplicationKey: input.deduplicationKey,
    correlationId: input.correlationId,
    occurredAt: input.occurredAt,
    groupable: policy.groupable === true,
    variables,
  };
}

export const proofEmailKinds = [
  "VERIFY_EMAIL",
  "EMAIL_CHANGE_VERIFY",
  "RESET_PASSWORD",
  "COMPANY_EMAIL_VERIFY",
] as const;
