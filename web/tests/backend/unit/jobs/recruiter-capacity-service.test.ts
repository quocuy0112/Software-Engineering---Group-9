import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: {
    $queryRaw: vi.fn(),
    jobPostReviewAggregate: { findUnique: vi.fn() },
    jobPosting: { findUnique: vi.fn(), update: vi.fn() },
  },
  prisma: { $transaction: vi.fn() },
  promote: vi.fn(),
  appendAudit: vi.fn(),
}));

vi.mock("@/backend/database/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/backend/services/jobs/application-stage-service", () => ({
  promoteWaitlistedApplicationsInTransaction: mocks.promote,
}));
vi.mock("@/backend/repositories/audit/prisma-audit-repository", () => ({
  PrismaAuditRepository: class {
    append(...args: unknown[]) {
      return mocks.appendAudit(...args);
    }
  },
}));

import { applyRecruiterCapacityIncrease } from "@/backend/services/jobs/recruiter-capacity-service";

describe("recruiter capacity update", () => {
  beforeEach(() => {
    mocks.prisma.$transaction.mockReset();
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof mocks.transaction) => unknown) =>
        callback(mocks.transaction),
    );
    mocks.transaction.$queryRaw.mockReset().mockResolvedValue([]);
    mocks.transaction.jobPostReviewAggregate.findUnique
      .mockReset()
      .mockResolvedValue({
        companyId: "company-db-1",
        publicJobPostingId: "public-job-1",
      });
    mocks.transaction.jobPosting.findUnique.mockReset().mockResolvedValue({
      id: "public-job-1",
      companyId: "company-db-1",
      status: "ACTIVE",
      numberOfHires: 1,
    });
    mocks.transaction.jobPosting.update.mockReset().mockResolvedValue({});
    mocks.promote
      .mockReset()
      .mockResolvedValue([
        { applicationId: "application-78", finalScore: 78, stageVersion: 7 },
      ]);
    mocks.appendAudit.mockReset().mockResolvedValue("audit-1");
  });

  it("updates public capacity and promotes waitlisted candidates on recruiter save", async () => {
    const result = await applyRecruiterCapacityIncrease({
      jobId: "catalog-job-1",
      companyId: "company-db-1",
      newCapacity: 2,
      actorUserId: "recruiter-1",
      now: new Date("2026-08-19T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      changed: true,
      previousCapacity: 1,
      newCapacity: 2,
      promoted: [{ applicationId: "application-78" }],
    });
    expect(mocks.transaction.jobPosting.update).toHaveBeenCalledWith({
      where: { id: "public-job-1" },
      data: { numberOfHires: 2, version: { increment: 1 } },
    });
    expect(mocks.promote).toHaveBeenCalledWith(
      expect.objectContaining({
        jobPostingId: "public-job-1",
        previousCapacity: 1,
        newCapacity: 2,
      }),
    );
    expect(mocks.appendAudit).toHaveBeenCalledTimes(1);
  });

  it("does not change public capacity when the value is unchanged", async () => {
    const result = await applyRecruiterCapacityIncrease({
      jobId: "catalog-job-1",
      companyId: "company-db-1",
      newCapacity: 1,
      actorUserId: "recruiter-1",
    });

    expect(result).toEqual({ changed: false, promoted: [] });
    expect(mocks.transaction.jobPosting.update).not.toHaveBeenCalled();
    expect(mocks.promote).not.toHaveBeenCalled();
    expect(mocks.appendAudit).not.toHaveBeenCalled();
  });
});
