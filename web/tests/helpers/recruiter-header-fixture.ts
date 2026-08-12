export type RecruiterHeaderFixtureState =
  | "NEVER_APPLIED"
  | "PENDING_REVIEW"
  | "REJECTED"
  | "APPROVED";

export function makeRecruiterHeaderFixture(
  state: RecruiterHeaderFixtureState,
  overrides: Record<string, unknown> = {},
) {
  const base = {
    account: {
      id: "account-candidate-001",
      name: "Candidate",
      email: "candidate@example.test",
    },
    session: { id: "session-001", userId: "account-candidate-001" },
    company: {
      id: "company-001",
      verificationState: state === "APPROVED" ? "ACTIVE" : "UNVERIFIED",
    },
    membership: {
      id: "membership-001",
      status: state === "APPROVED" ? "ACTIVE" : "REMOVED",
    },
    latestRequest: {
      id: "request-001",
      createdAt: "2026-01-01T00:00:00.000Z",
      state:
        state === "PENDING_REVIEW"
          ? "PENDING_REVIEW"
          : state === "REJECTED"
            ? "REJECTED"
            : state === "APPROVED"
              ? "APPROVED"
              : null,
    },
  };
  return { ...base, ...overrides };
}
