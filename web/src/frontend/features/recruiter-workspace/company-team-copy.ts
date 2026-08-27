import type { WorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

type CompanyTeamCopy = {
  manageTeam: string;
  breadcrumb: string;
  title: string;
  description: string;
  teamApplications: string;
  teamMembers: (count: number) => string;
  inviteTeammate: string;
  inviteRequirement: string;
  workEmail: string;
  role: string;
  sending: string;
  sendInvitation: string;
  membersTitle: string;
  membersDescription: string;
  total: (count: number) => string;
  makeRole: (role: string) => string;
  restore: string;
  suspend: string;
  remove: string;
  primaryOwner: string;
  pendingInvitations: string;
  pendingDescription: string;
  pendingCount: (count: number) => string;
  invitedAs: (role: string, date: string) => string;
  revoke: string;
  noPendingInvitations: string;
  noPendingDescription: string;
  teamActivity: string;
  activityDescription: string;
  recent: (count: number) => string;
  activityEntry: (actor: string, action: string, email: string) => string;
  activityLabel: (kind: string) => string;
  activityRole: (role: string) => string;
  system: string;
  noActivity: string;
  noActivityDescription: string;
  invitationQueued: string;
  invitationQueuedDescription: string;
  invitationNotSent: string;
  sendInvitationError: string;
  memberUpdated: string;
  updateMemberError: string;
  invitationRevoked: string;
  revokeInvitationError: string;
  revokeConfirm: string;
  removeConfirm: (name: string) => string;
  invitationError: (code?: string) => string;
  roleLabel: (role: string) => string;
  statusLabel: (status: string) => string;
};

const englishCopy: CompanyTeamCopy = {
  manageTeam: "Manage team",
  breadcrumb: "Company settings / Team",
  title: "Build your hiring team",
  description:
    "Invite trusted colleagues and manage their access to this company.",
  teamApplications: "Team Applications",
  teamMembers: (count) => `${count} team members`,
  inviteTeammate: "Invite a teammate",
  inviteRequirement: "They must already have a SmartHire account to accept.",
  workEmail: "Work email",
  role: "Role",
  sending: "Sending.",
  sendInvitation: "Send invitation",
  membersTitle: "Team members",
  membersDescription: "Manage roles and access for your company.",
  total: (count) => `${count} total`,
  makeRole: (role) => `Make ${role}`,
  restore: "Restore",
  suspend: "Suspend",
  remove: "Remove",
  primaryOwner: "Primary owner",
  pendingInvitations: "Pending invitations",
  pendingDescription: "People who have not yet joined your company.",
  pendingCount: (count) => `${count} pending`,
  invitedAs: (role, date) => `Invited as ${role} · expires ${date}`,
  revoke: "Revoke",
  noPendingInvitations: "No pending invitations",
  noPendingDescription: "Use the form above to invite your first teammate.",
  teamActivity: "Team activity",
  activityDescription: "A recent, immutable record of team access changes.",
  recent: (count) => `${count} recent`,
  activityEntry: (actor, action, email) => `${actor} ${action} ${email}`,
  activityLabel: (kind) =>
    ({
      INVITED: "invited",
      ACCEPTED: "accepted",
      DECLINED: "declined",
      REVOKED: "revoked",
      ROLE_CHANGED: "changed the role of",
      SUSPENDED: "suspended",
      RESTORED: "restored",
      REMOVED: "removed",
    })[kind] ?? kind.toLowerCase(),
  activityRole: (role) => `Role: ${role}`,
  system: "System",
  noActivity: "No activity yet",
  noActivityDescription:
    "Invitation and member-access actions will appear here.",
  invitationQueued: "Invitation queued for delivery",
  invitationQueuedDescription:
    "The recipient can review and respond from their SmartHire email.",
  invitationNotSent: "Invitation was not sent",
  sendInvitationError: "Unable to send this invitation. Please try again.",
  memberUpdated: "Member access updated.",
  updateMemberError: "Unable to update this member.",
  invitationRevoked: "Invitation revoked.",
  revokeInvitationError: "Unable to revoke this invitation.",
  revokeConfirm:
    "Revoke this pending invitation? The recipient will no longer be able to join.",
  removeConfirm: (name) => `Remove ${name} from the company?`,
  invitationError: (code) => {
    switch (code) {
      case "INVITATION_EXISTS":
        return "This email already has a pending invitation. Revoke it before sending a new one.";
      case "MEMBERSHIP_EXISTS":
        return "This account is already a member of your company.";
      case "RECIPIENT_UNAVAILABLE":
        return "No active SmartHire account is available for this email.";
      default:
        return "Unable to send this invitation. Please try again.";
    }
  },
  roleLabel: (role) =>
    role === "HR_MANAGER"
      ? "HR Manager"
      : role === "RECRUITER"
        ? "Recruiter"
        : "Owner",
  statusLabel: (status) => status.charAt(0) + status.slice(1).toLowerCase(),
};

const vietnameseCopy: CompanyTeamCopy = {
  manageTeam: "Quản lý đội ngũ",
  breadcrumb: "Cài đặt công ty / Đội ngũ",
  title: "Xây dựng đội ngũ tuyển dụng",
  description:
    "Mời đồng nghiệp đáng tin cậy và quản lý quyền truy cập công ty.",
  teamApplications: "Hồ sơ ứng tuyển đội ngũ",
  teamMembers: (count) => `${count} thành viên đội ngũ`,
  inviteTeammate: "Mời thành viên đội ngũ",
  inviteRequirement: "Người được mời cần có tài khoản SmartHire để chấp nhận.",
  workEmail: "Email công việc",
  role: "Vai trò",
  sending: "Đang gửi...",
  sendInvitation: "Gửi lời mời",
  membersTitle: "Thành viên đội ngũ",
  membersDescription: "Quản lý vai trò và quyền truy cập công ty.",
  total: (count) => `${count} tổng cộng`,
  makeRole: (role) => `Chuyển thành ${role}`,
  restore: "Khôi phục",
  suspend: "Tạm ngưng",
  remove: "Xóa",
  primaryOwner: "Owner chính",
  pendingInvitations: "Lời mời đang chờ",
  pendingDescription: "Những người chưa tham gia công ty.",
  pendingCount: (count) => `${count} đang chờ`,
  invitedAs: (role, date) => `Được mời với vai trò ${role} · hết hạn ${date}`,
  revoke: "Thu hồi",
  noPendingInvitations: "Không có lời mời đang chờ",
  noPendingDescription: "Dùng biểu mẫu phía trên để mời thành viên đầu tiên.",
  teamActivity: "Hoạt động đội ngũ",
  activityDescription:
    "Lịch sử gần đây, không thể chỉnh sửa, về thay đổi quyền đội ngũ.",
  recent: (count) => `${count} gần đây`,
  activityEntry: (actor, action, email) => `${actor} ${action} ${email}`,
  activityLabel: (kind) =>
    ({
      INVITED: "đã mời",
      ACCEPTED: "đã chấp nhận",
      DECLINED: "đã từ chối",
      REVOKED: "đã thu hồi",
      ROLE_CHANGED: "đã thay đổi vai trò của",
      SUSPENDED: "đã tạm ngưng",
      RESTORED: "đã khôi phục",
      REMOVED: "đã xóa",
    })[kind] ?? kind.toLowerCase(),
  activityRole: (role) => `Vai trò: ${role}`,
  system: "Hệ thống",
  noActivity: "Chưa có hoạt động",
  noActivityDescription:
    "Lời mời và thao tác quyền thành viên sẽ hiển thị tại đây.",
  invitationQueued: "Đã xếp hàng gửi lời mời",
  invitationQueuedDescription:
    "Người nhận có thể xem và phản hồi từ email SmartHire của họ.",
  invitationNotSent: "Chưa gửi được lời mời",
  sendInvitationError: "Không thể gửi lời mời. Vui lòng thử lại.",
  memberUpdated: "Đã cập nhật quyền thành viên.",
  updateMemberError: "Không thể cập nhật thành viên này.",
  invitationRevoked: "Đã thu hồi lời mời.",
  revokeInvitationError: "Không thể thu hồi lời mời.",
  revokeConfirm:
    "Thu hồi lời mời đang chờ này? Người nhận sẽ không thể tham gia nữa.",
  removeConfirm: (name) => `Xóa ${name} khỏi công ty?`,
  invitationError: (code) => {
    switch (code) {
      case "INVITATION_EXISTS":
        return "Email này đã có lời mời đang chờ. Hãy thu hồi lời mời trước khi gửi lại.";
      case "MEMBERSHIP_EXISTS":
        return "Tài khoản này đã là thành viên của công ty.";
      case "RECIPIENT_UNAVAILABLE":
        return "Không có tài khoản SmartHire đang hoạt động cho email này.";
      default:
        return "Không thể gửi lời mời. Vui lòng thử lại.";
    }
  },
  roleLabel: (role) =>
    role === "HR_MANAGER"
      ? "Quản lý nhân sự"
      : role === "RECRUITER"
        ? "Chuyên viên tuyển dụng"
        : "Owner",
  statusLabel: (status) =>
    ({ ACTIVE: "Đang hoạt động", SUSPENDED: "Tạm ngưng", REMOVED: "Đã xóa" })[
      status
    ] ?? status,
};

export function getCompanyTeamCopy(locale: WorkspaceLocale) {
  return locale === "vi" ? vietnameseCopy : englishCopy;
}

export function formatCompanyTeamDate(
  value: Date | string,
  locale: WorkspaceLocale,
  withTime = false,
) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(new Date(value));
}
