export const ADMIN_FEATURE_FIXED_NOW = new Date("2026-01-15T00:00:00.000Z");

export function accountFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "account-0001",
    accountReference: "account-0001",
    displayName: "Synthetic Candidate",
    maskedEmail: "s***@example.test",
    registeredAt: "2026-01-01T00:00:00.000Z",
    type: "CANDIDATE" as const,
    status: "ACTIVE" as const,
    version: 1,
    counts: { kind: "CANDIDATE" as const, cvCount: 0, applicationCount: 0 },
    ...overrides,
  };
}

export function verificationFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "request-0001",
    applicantId: "account-0001",
    companyName: "Synthetic Company",
    taxCode: "0123456789",
    state: "PENDING_REVIEW" as const,
    applicantEligibility: "ACTIVE" as const,
    submittedAt: "2026-01-01T00:00:00.000Z",
    resubmissionCount: 0,
    assignedAdminRef: null,
    version: 1,
    ...overrides,
  };
}

export function withFixedClock<T>(work: (now: Date) => T) {
  return work(new Date(ADMIN_FEATURE_FIXED_NOW));
}
