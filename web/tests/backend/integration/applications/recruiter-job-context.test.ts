import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecruiterApplicationAuthorization } from "@/backend/applications/authorization/recruiter-application-authorization";

vi.mock("@/backend/services/jobs/recruiter-job-posting-data", () => ({
  authorizeLegacyRecruiterJobs: vi.fn(async () => new Map()),
}));

function activeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "persisted-job-1",
    companyId: "company-1",
    title: "Backend Engineer",
    status: "ACTIVE",
    removedAt: null,
    company: {
      verificationState: "ACTIVE",
      verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      verificationInactiveAt: null,
      memberships: [
        {
          role: "RECRUITER",
          status: "ACTIVE",
          removedAt: null,
          user: { state: "ACTIVE", deletedAt: null },
        },
      ],
    },
    ...overrides,
  };
}

function database() {
  return {
    jobPosting: { findMany: vi.fn() },
    jobPostReviewAggregate: { findMany: vi.fn() },
    jobApplication: { findFirst: vi.fn() },
  };
}

describe("Recruiter canonical job context", () => {
  let db: ReturnType<typeof database>;

  beforeEach(() => {
    db = database();
    db.jobPosting.findMany.mockResolvedValue([]);
    db.jobPostReviewAggregate.findMany.mockResolvedValue([]);
    db.jobApplication.findFirst.mockResolvedValue(null);
  });

  it("uses a valid persisted JobPosting.id directly", async () => {
    db.jobPosting.findMany.mockResolvedValue([activeRow()]);
    const authorization = new RecruiterApplicationAuthorization(db as never);

    await expect(authorization.authorizeJob("user-1", "persisted-job-1")).resolves.toMatchObject({
      authorized: true,
      requestedJobId: "persisted-job-1",
      jobPostingId: "persisted-job-1",
      companyId: "company-1",
      jobTitle: "Backend Engineer",
      jobStatus: "ACTIVE",
      membershipRole: "RECRUITER",
    });
  });

  it("resolves a catalogue reference through the unique review aggregate mapping", async () => {
    db.jobPostReviewAggregate.findMany.mockResolvedValue([
      {
        jobId: "catalogue-job-1",
        companyId: "company-1",
        publicJobPostingId: "persisted-job-1",
        publicJobPosting: activeRow({ status: "CLOSED" }),
        company: activeRow().company,
      },
    ]);
    const authorization = new RecruiterApplicationAuthorization(db as never);

    await expect(authorization.authorizeJob("user-1", "catalogue-job-1")).resolves.toMatchObject({
      authorized: true,
      requestedJobId: "catalogue-job-1",
      jobPostingId: "persisted-job-1",
      companyId: "company-1",
      jobStatus: "CLOSED",
    });
  });

  it("fails safely for absent, ambiguous, or company-mismatched mappings", async () => {
    db.jobPostReviewAggregate.findMany.mockResolvedValue([
      {
        jobId: "ambiguous-job",
        companyId: "company-1",
        publicJobPostingId: "persisted-job-1",
        publicJobPosting: activeRow(),
        company: activeRow().company,
      },
      {
        jobId: "ambiguous-job",
        companyId: "company-1",
        publicJobPostingId: "persisted-job-2",
        publicJobPosting: activeRow({ id: "persisted-job-2" }),
        company: activeRow().company,
      },
      {
        jobId: "wrong-company",
        companyId: "company-2",
        publicJobPostingId: "persisted-job-1",
        publicJobPosting: activeRow(),
        company: activeRow({ companyId: "company-2" }).company,
      },
    ]);
    const authorization = new RecruiterApplicationAuthorization(db as never);

    const results = await authorization.authorizeJobs("user-1", [
      "missing-job",
      "ambiguous-job",
      "wrong-company",
      "removed-job",
    ]);
    expect(results).toHaveLength(4);
    expect(results.every((result) => result.authorized === false)).toBe(true);
    expect(results.every((result) => result.companyId === "")).toBe(true);
  });

  it("keeps owned application documents readable after the public posting is removed", async () => {
    db.jobPostReviewAggregate.findMany.mockResolvedValue([
      {
        jobId: "historical-job",
        companyId: "company-1",
        publicJobPostingId: "persisted-job-3",
        publicJobPosting: activeRow({
          id: "persisted-job-3",
          status: "REMOVED",
          removedAt: new Date(),
        }),
        company: activeRow().company,
      },
    ]);
    const authorization = new RecruiterApplicationAuthorization(db as never);

    await expect(authorization.authorizeJob("user-1", "historical-job")).resolves.toMatchObject({
      authorized: true,
      requestedJobId: "historical-job",
      jobPostingId: "persisted-job-3",
      jobStatus: "CLOSED",
      canView: true,
      canMoveStages: false,
      canReject: false,
      canRecordOfferDeclined: false,
      canConfirmHired: false,
    });
  });

  it("queries only ACTIVE/CLOSED non-removed jobs and verified active memberships", async () => {
    const authorization = new RecruiterApplicationAuthorization(db as never);
    await authorization.authorizeJob("user-1", "persisted-job-1");

    expect(db.jobPosting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["ACTIVE", "CLOSED"] },
          removedAt: null,
          company: expect.objectContaining({
            verificationState: "ACTIVE",
            verificationInactiveAt: null,
            memberships: {
              some: expect.objectContaining({
                userId: "user-1",
                status: "ACTIVE",
                removedAt: null,
                user: { state: "ACTIVE", deletedAt: null },
              }),
            },
          }),
        }),
      }),
    );
  });
});
