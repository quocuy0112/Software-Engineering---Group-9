import "server-only";

const REASON_CATEGORY_LABELS: Record<string, string> = {
  SECURITY_COMPROMISE: "Suspected security compromise",
  POLICY_VIOLATION: "Policy violation",
  USER_REQUEST: "Requested by the account holder",
  VERIFICATION_FAILURE: "Verification failure",
  INCIDENT_RESOLVED: "Incident resolved",
  ACCESS_CLEANUP: "Access cleanup",
  OTHER: "Other",
};

const REJECTION_CATEGORY_LABELS: Record<string, string> = {
  DOCUMENT_UNREADABLE: "The submitted document could not be read",
  TAX_ID_MISMATCH: "The tax identifier did not match",
  DOCUMENT_EXPIRED: "The submitted document has expired",
  COMPANY_INFORMATION_MISMATCH: "Company information did not match",
  DUPLICATE_OR_CONFLICTING_REQUEST: "Duplicate or conflicting request",
  POLICY_INELIGIBLE: "Not eligible under policy",
  OTHER: "Other",
};

const MEMBERSHIP_ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  HR_MANAGER: "HR Manager",
  RECRUITER: "Recruiter",
  HIRING_MANAGER: "Hiring Manager",
};

const VERIFICATION_STATE_LABELS: Record<string, string> = {
  PENDING_CHECKS: "pending safety checks",
  PENDING_REVIEW: "pending review",
  CHANGES_REQUESTED: "awaiting your changes",
  RESUBMITTED: "resubmitted",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
};

const NEXT_ACTION_LABELS: Record<string, string> = {
  WAIT_FOR_REVIEW: "Your request is awaiting administrator review.",
  WAIT: "No further action is needed right now.",
  SUBMIT_NEW_REQUEST: "You can submit a new request.",
  OPEN_RECRUITER_WORKSPACE: "Open the Recruiter workspace to get started.",
};

export function formatEmailTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function reasonCategoryLabel(code: string): string {
  return REASON_CATEGORY_LABELS[code] ?? code;
}

export function rejectionCategoryLabel(code: string): string {
  return REJECTION_CATEGORY_LABELS[code] ?? code;
}

export function membershipRoleLabel(role: string): string {
  return MEMBERSHIP_ROLE_LABELS[role] ?? role;
}

export function verificationStateLabel(state: string): string {
  return VERIFICATION_STATE_LABELS[state] ?? state;
}

export function nextActionLabel(action: string): string {
  return NEXT_ACTION_LABELS[action] ?? action;
}