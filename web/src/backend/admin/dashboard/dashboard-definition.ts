import "server-only";
import { ADMIN_STATE_DEFINITION_VERSION } from "@/shared/contracts/admin/common";

export const DASHBOARD_STATE_DEFINITION_VERSION =
  ADMIN_STATE_DEFINITION_VERSION;
export const DASHBOARD_MAX_AGE_MS = 60_000;
export const DASHBOARD_REFRESH_MS = 30_000;

export const dashboardDefinition = Object.freeze({
  candidateActive: {
    unit: "PEOPLE",
    filter: { candidate: true, accountState: "ACTIVE" },
  },
  candidateSuspended: {
    unit: "PEOPLE",
    filter: { candidate: true, accountState: "SUSPENDED" },
  },
  candidatePending: {
    unit: "PEOPLE",
    filter: { candidate: true, accountState: "PENDING_VERIFICATION" },
  },
  recruiterEnabledAccounts: {
    unit: "ACCOUNTS",
    filter: { recruiterEnabled: true },
  },
  ownerMemberships: {
    unit: "MEMBERSHIPS",
    filter: { membershipRole: "OWNER", membershipState: "ACTIVE" },
  },
  hrManagerMemberships: {
    unit: "MEMBERSHIPS",
    filter: { membershipRole: "HR_MANAGER", membershipState: "ACTIVE" },
  },
  recruiterMemberships: {
    unit: "MEMBERSHIPS",
    filter: { membershipRole: "RECRUITER", membershipState: "ACTIVE" },
  },
  hiringManagerMemberships: {
    unit: "MEMBERSHIPS",
    filter: { membershipRole: "HIRING_MANAGER", membershipState: "ACTIVE" },
  },
  suspendedMemberships: {
    unit: "MEMBERSHIPS",
    filter: { membershipState: "SUSPENDED" },
  },
  pendingVerificationRequests: {
    unit: "REQUESTS",
    filter: { verificationPending: true },
  },
  pendingModerationReports: {
    unit: "REPORTS",
    filter: { moderationState: "PENDING_REVIEW" },
  },
} as const);

export type DashboardMetricKey = keyof typeof dashboardDefinition;
export type DashboardMetrics = Record<
  DashboardMetricKey,
  {
    value: number;
    unit: (typeof dashboardDefinition)[DashboardMetricKey]["unit"];
  }
>;

export function calculationMetadata(calculatedAt = new Date()) {
  return {
    calculatedAt: calculatedAt.toISOString(),
    stateDefinitionVersion: DASHBOARD_STATE_DEFINITION_VERSION,
  };
}
