import { describe, expect, it, vi } from "vitest";
import { createEmptyJobPosting } from "@/shared/contracts/recruiter-job-posting";

const mocks = vi.hoisted(() => ({
  jobsRepository: { read: vi.fn() },
  companiesRepository: { read: vi.fn() },
  readUserJobState: vi.fn(),
  listAppliedJobIds: vi.fn(),
  listApplicationLimitJobIds: vi.fn(),
  readMockAppliedJobIds: vi.fn(),
  jobPostReviewAggregate: { findMany: vi.fn() },
}));

vi.mock("@/backend/repositories/jobs/job-catalogue-repository-factory", () => ({
  configuredJsonJobCatalogueRepository: (fileName: string) =>
    fileName === "jobs.json" ? mocks.jobsRepository : mocks.companiesRepository,
}));

vi.mock("@/backend/database/prisma", () => ({
  prisma: { jobPostReviewAggregate: mocks.jobPostReviewAggregate },
}));

vi.mock("@/backend/services/jobs/user-job-state-store", () => ({
  readUserJobState: mocks.readUserJobState,
}));

vi.mock("@/backend/services/jobs/recruiter-job-posting-data", () => ({
  readMockAppliedJobIds: mocks.readMockAppliedJobIds,
}));

vi.mock(
  "@/backend/repositories/jobs/prisma-application-tracking-repository",
  () => ({
    PrismaApplicationTrackingRepository: vi.fn().mockImplementation(
      function () {
        return {
          listAppliedJobIds: mocks.listAppliedJobIds,
          listApplicationLimitJobIds: mocks.listApplicationLimitJobIds,
        };
      },
    ),
  }),
);

function recruiterCatalogueJob() {
  const empty = createEmptyJobPosting("catalog-company");
  return {
    ...empty,
    id: "catalog-job-1",
    slug: "senior-product-designer-hcm-catalog",
    title: "Senior Product Designer",
    shortPitch: "Design thoughtful hiring experiences.",
    description: {
      ...empty.description,
      overview: "Own end-to-end product design.",
      responsibilities: ["Shape product direction."],
      requirements: ["Strong product design experience."],
    },
    postedAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  };
}

describe("candidate job workspace projection", () => {
  it("uses the public posting id for recruiter jobs saved by a candidate", async () => {
    const catalogueJob = recruiterCatalogueJob();
    const snapshotFields = Object.fromEntries(
      Object.entries(catalogueJob).filter(
        ([key]) =>
          !new Set([
            "status",
            "approvalComment",
            "isVerified",
            "postedAt",
            "updatedAt",
            "stats",
          ]).has(key),
      ),
    );
    const snapshot = {
      ...snapshotFields,
      companyId: "database-company",
    };
    const publishedAt = new Date("2026-08-20T00:00:00.000Z");

    mocks.jobsRepository.read.mockResolvedValue([catalogueJob]);
    mocks.companiesRepository.read.mockResolvedValue([
      {
        id: "catalog-company",
        slug: "northstar-labs",
        name: "Northstar Labs",
        logo: null,
        size: "51-200 employees",
        industry: "Technology",
        address: "Ho Chi Minh City",
        website: null,
        description: "A product company.",
      },
    ]);
    mocks.jobPostReviewAggregate.findMany.mockResolvedValue([
      {
        jobId: "catalog-job-1",
        approvedVersion: { snapshot },
        publicJobPosting: {
          id: "public-job-1",
          status: "ACTIVE",
          publishedAt,
          updatedAt: publishedAt,
          applicationDeadline: null,
          _count: { applications: 0 },
        },
        closedAt: null,
        company: {
          verificationState: "ACTIVE",
          verifiedAt: publishedAt,
          verificationInactiveAt: null,
        },
      },
    ]);
    mocks.readUserJobState.mockResolvedValue({
      userId: "candidate-1",
      savedJobIds: ["public-job-1"],
      hiddenJobIds: [],
      appliedJobIds: [],
      jobPreferences: {
        professionalPositions: [],
        customPositions: [],
        skills: [],
        desiredSalaryMin: 0,
        workLocations: [],
        openToRelocation: false,
        experienceLevel: "no_experience",
      },
      savedFilterPresets: [],
    });
    mocks.listAppliedJobIds.mockResolvedValue([]);
    mocks.listApplicationLimitJobIds.mockResolvedValue([]);
    mocks.readMockAppliedJobIds.mockResolvedValue([]);

    const { readJobWorkspaceSnapshot } = await import(
      "@/backend/services/jobs/job-workspace-data"
    );
    const result = await readJobWorkspaceSnapshot(
      "candidate-1",
      new Date("2026-08-26T00:00:00.000Z"),
    );

    expect(result.jobs[0]?.id).toBe("public-job-1");
    expect(result.savedJobs).toHaveLength(1);
    expect(result.savedJobs[0]).toMatchObject({
      id: "public-job-1",
      title: "Senior Product Designer",
      actions: { saved: true },
      company: { displayName: "Northstar Labs" },
    });
  });
});
