import "server-only";

export const adminSecurityEventKinds = [
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_REINSTATED",
  "ALL_SESSIONS_REVOKED",
  "MEMBERSHIP_SUSPENDED",
  "MEMBERSHIP_RESTORED",
  "MEMBERSHIP_REMOVED",
] as const;
export type AdminSecurityEventKind = (typeof adminSecurityEventKinds)[number];

export const verificationEventKinds = [
  "VERIFICATION_APPROVED",
  "VERIFICATION_RECEIPT",
  "VERIFICATION_CHANGES_REQUESTED",
  "VERIFICATION_REJECTED",
  "VERIFICATION_CANCELLED",
  "VERIFICATION_DELAYED",
  "VERIFICATION_EXPIRED",
] as const;
export type VerificationEventKind = (typeof verificationEventKinds)[number];

export type CompanyMembershipRole =
  | "OWNER"
  | "HR_MANAGER"
  | "RECRUITER"
  | "HIRING_MANAGER";

function versionedKey(
  aggregate: "account" | "membership" | "verification",
  aggregateId: string,
  eventKind: string,
  resultingVersion: number,
) {
  if (
    !aggregateId ||
    !Number.isInteger(resultingVersion) ||
    resultingVersion < 1
  )
    throw new Error("BUSINESS_EVENT_KEY_INVALID");
  return `${aggregate}:${aggregateId}:${eventKind}:version:${resultingVersion}`;
}

export const accountBusinessEventKey = (
  accountId: string,
  eventKind: Extract<
    AdminSecurityEventKind,
    "ACCOUNT_SUSPENDED" | "ACCOUNT_REINSTATED" | "ALL_SESSIONS_REVOKED"
  >,
  resultingVersion: number,
) => versionedKey("account", accountId, eventKind, resultingVersion);

export const membershipBusinessEventKey = (
  membershipId: string,
  eventKind: Extract<
    AdminSecurityEventKind,
    "MEMBERSHIP_SUSPENDED" | "MEMBERSHIP_RESTORED" | "MEMBERSHIP_REMOVED"
  >,
  resultingVersion: number,
) => versionedKey("membership", membershipId, eventKind, resultingVersion);

export const verificationBusinessEventKey = (
  requestId: string,
  eventKind: VerificationEventKind,
  resultingVersion: number,
) => versionedKey("verification", requestId, eventKind, resultingVersion);

export const securityNotificationIdempotencyKey = (businessEventKey: string) =>
  `security-notification:${businessEventKey}`;
export const emailDeliveryIdempotencyKey = (businessEventKey: string) =>
  `email-delivery:${businessEventKey}`;
