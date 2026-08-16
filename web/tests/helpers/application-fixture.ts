import type {
  ApplicationPage,
  SubmittedCandidate,
} from "@/shared/contracts/applications";

export function applicationClock(value = "2026-08-15T00:00:00.000Z") {
  return new Date(value);
}

export function candidateCvFixture(
  overrides: Partial<SubmittedCandidate["cv"]> = {},
) {
  return {
    available: true,
    mediaType: "application/pdf" as const,
    previewSupported: true,
    ...overrides,
  };
}

export function coverLetterFixture(
  overrides: Partial<Exclude<SubmittedCandidate["coverLetter"], { kind: "NONE" }>> = {},
) {
  return {
    kind: "TEXT" as const,
    available: true,
    previewSupported: true,
    ...overrides,
  };
}

export function submittedCandidateFixture(
  overrides: Partial<SubmittedCandidate> = {},
): SubmittedCandidate {
  return {
    applicationId: "application-1",
    candidate: {
      displayName: "Nguyen Minh Anh",
      verifiedEmail: "anh@example.test",
      sharedPhone: "+84 90 000 0000",
      avatarUrl: null,
    },
    submittedAt: "2026-08-14T10:00:00.000Z",
    stage: "APPLIED",
    cv: candidateCvFixture(),
    coverLetter: coverLetterFixture(),
    ...overrides,
  };
}

export function applicationPageFixture(
  items: SubmittedCandidate[] = [submittedCandidateFixture()],
  nextCursor: string | null = null,
): ApplicationPage {
  return { items, nextCursor };
}

export function legalHoldFixture(overrides: Record<string, unknown> = {}) {
  return {
    purposeCode: "COMPLAINT_REVIEW",
    policyVersion: "application-retention-v1",
    startsAt: applicationClock().toISOString(),
    endsAt: null,
    releasedAt: null,
    ...overrides,
  };
}
