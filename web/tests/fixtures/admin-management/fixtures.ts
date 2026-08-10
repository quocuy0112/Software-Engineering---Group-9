export const FIXED_NOW = new Date("2026-08-10T09:00:00.000Z");

export function adminFixture(overrides: Record<string, unknown> = {}) {
  return {
    accountId: "acct_admin_001",
    grantId: "grant_001",
    sessionId: "session_admin_001",
    accountState: "ACTIVE",
    grantState: "ACTIVE",
    twoFactorVerifiedAt: FIXED_NOW,
    ...overrides,
  } as const;
}

export function accountFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "acct_candidate_001",
    name: "Nguyen Van A",
    email: "candidate@example.vn",
    state: "ACTIVE",
    createdAt: FIXED_NOW,
    version: 1,
    ...overrides,
  } as const;
}

export function companyFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "company_001",
    legalName: "Cong ty TNHH Mau",
    normalizedTaxIdentifier: "0312345678",
    verificationState: "ACTIVE",
    ...overrides,
  } as const;
}

export function membershipFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "membership_001",
    companyId: "company_001",
    userId: "acct_candidate_001",
    role: "OWNER",
    state: "ACTIVE",
    version: 1,
    ...overrides,
  } as const;
}

export function verificationFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "verification_001",
    applicantUserId: "acct_candidate_001",
    normalizedTaxIdentifier: "0312345678",
    state: "PENDING_REVIEW",
    submissionVersion: 1,
    version: 1,
    ...overrides,
  } as const;
}

export function reportFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "report_001",
    reporterUserId: "acct_candidate_001",
    targetType: "JOB",
    targetReference: "job_001",
    category: "MISLEADING_CONTENT",
    state: "PENDING_REVIEW",
    version: 1,
    ...overrides,
  } as const;
}

export function notificationFailureFixture(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "notification_001",
    status: "RETRYING",
    attemptCount: 2,
    nextAttemptAt: new Date(FIXED_NOW.getTime() + 5 * 60_000),
    failureCategory: "TEMPORARY_UNAVAILABLE",
    ...overrides,
  } as const;
}
