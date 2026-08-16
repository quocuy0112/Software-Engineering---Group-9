const fixtureTime = "2026-08-15T08:00:00.000Z";

export type JobReviewSnapshotFixture = ReturnType<
  typeof buildJobReviewSnapshot
>;

export function buildJobReviewSnapshot(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "job-review-fixture-001",
    slug: "senior-platform-engineer-ho-chi-minh-jobrev01",
    companyId: "company-review-fixture-001",
    industry: "Information Technology",
    industryCode: "r04",
    subIndustry: "Software Engineering",
    title: "Senior Platform Engineer",
    shortPitch: "Build reliable hiring infrastructure for growing teams.",
    categoryIds: ["r04-software-engineering"],
    categoryFamily: "r04",
    skillTags: ["TypeScript", "PostgreSQL", "Distributed Systems"],
    location: {
      city: "Ho Chi Minh City",
      district: "District 1",
      isNationwideRemote: false,
    },
    salary: {
      min: 35_000_000,
      max: 55_000_000,
      currency: "VND",
      period: "month",
      isNegotiable: true,
    },
    experience: { minYears: 5, label: "5+ years" },
    level: "senior",
    employmentType: "full_time",
    workArrangement: "hybrid",
    workOnSaturday: false,
    education: "Bachelor degree or equivalent experience",
    age: "",
    numberOfHires: 2,
    isUrgent: false,
    applyDeadline: "2026-09-30T16:59:59.000Z",
    description: {
      overview: "Own the reliability and evolution of SmartHire services.",
      topReasonsToJoin: ["High ownership", "Clear engineering standards"],
      responsibilities: [
        "Design and operate reliable application services.",
        "Review architecture and mentor engineers.",
      ],
      requirements: [
        "Production TypeScript and PostgreSQL experience.",
        "Strong written and verbal communication.",
      ],
      benefits: [{ icon: "award", label: "Annual learning allowance" }],
      generalInfo: {
        reportsTo: "Engineering Manager",
        department: "Platform Engineering",
        workingHours: "Monday-Friday, 09:00-18:00",
        workAddress: "District 1, Ho Chi Minh City",
      },
    },
    ...overrides,
  };
}

export function buildJobReviewCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: "company-review-fixture-001",
    displayName: "SmartHire Fixture Company",
    verificationState: "ACTIVE",
    active: true,
    protectedVerificationHref:
      "/admin/verification/recruiter-verification-fixture-001",
    ...overrides,
  };
}

export function buildJobReviewAdministrator(
  overrides: Record<string, unknown> = {},
) {
  return {
    userId: "admin-review-fixture-001",
    grantId: "admin-grant-review-fixture-001",
    displayName: "Review Administrator",
    state: "ACTIVE",
    expiresAt: null,
    ...overrides,
  };
}

export function buildJobReviewVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "review-version-fixture-001",
    jobId: "job-review-fixture-001",
    companyId: "company-review-fixture-001",
    sequence: 1,
    state: "PENDING_REVIEW",
    assignment: null,
    submittedAt: fixtureTime,
    ageSeconds: 0,
    version: 1,
    integrityState: "VALID",
    snapshot: buildJobReviewSnapshot(),
    ...overrides,
  };
}

export const jobReviewFixtureTime = fixtureTime;
