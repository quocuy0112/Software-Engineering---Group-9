import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.hoisted(() => ({
  jobPostReviewAggregate: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  jobPostReviewPrivateNote: { deleteMany: vi.fn() },
  jobPostReviewHistory: { deleteMany: vi.fn() },
  jobPostReviewVersion: { deleteMany: vi.fn() },
  jobPostOperationalHistory: { deleteMany: vi.fn() },
  auditEvent: { create: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({
  jobPostReviewAggregate: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/backend/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/backend/env/runtime", () => ({
  serverEnvironment: { JOB_REVIEW_DELETED_RETENTION_DAYS: 180 },
}));

import { runDeletedJobReviewRetentionCycle } from "@/backend/jobs/review/job-post-review-retention";

describe("deleted job review retention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.jobPostReviewAggregate.findMany.mockResolvedValue([
      { id: "deleted-draft-aggregate" },
    ]);
    transaction.jobPostReviewAggregate.findFirst.mockResolvedValue({
      jobId: "deleted-draft-job",
      versions: [{ id: "review-1" }, { id: "review-2" }],
    });
    transaction.jobPostReviewAggregate.deleteMany.mockResolvedValue({
      count: 1,
    });
    transaction.auditEvent.create.mockResolvedValue({ id: "audit-purge-1" });
    prismaMock.$transaction.mockImplementation(
      async (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    );
  });

  it("purges only old soft-deleted drafts that were never approved or published", async () => {
    const now = new Date("2026-08-25T00:00:00.000Z");

    await expect(runDeletedJobReviewRetentionCycle(now, 25)).resolves.toEqual({
      scanned: 1,
      purged: 1,
      skipped: 0,
    });

    expect(prismaMock.jobPostReviewAggregate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          softDeletedAt: {
            lte: new Date("2026-02-26T00:00:00.000Z"),
          },
          pendingVersionId: null,
          approvedVersionId: null,
          publicJobPostingId: null,
          correctionRequests: { none: {} },
          featuredPlacements: { none: {} },
          enforcementTargets: { none: {} },
        }),
        take: 25,
      }),
    );
    expect(
      transaction.jobPostReviewPrivateNote.deleteMany,
    ).toHaveBeenCalledBefore(transaction.jobPostReviewVersion.deleteMany);
    expect(transaction.jobPostReviewHistory.deleteMany).toHaveBeenCalledBefore(
      transaction.jobPostReviewVersion.deleteMany,
    );
    expect(
      transaction.jobPostOperationalHistory.deleteMany,
    ).toHaveBeenCalledBefore(transaction.jobPostReviewAggregate.deleteMany);
    expect(transaction.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "job_post_review.retention_purged",
        targetId: "deleted-draft-job",
        result: "SUCCESS",
      }),
    });
  });

  it("leaves a candidate untouched when it is no longer purgeable", async () => {
    transaction.jobPostReviewAggregate.findFirst.mockResolvedValue(null);

    await expect(
      runDeletedJobReviewRetentionCycle(new Date("2026-08-25T00:00:00.000Z")),
    ).resolves.toEqual({ scanned: 1, purged: 0, skipped: 1 });
    expect(transaction.jobPostReviewVersion.deleteMany).not.toHaveBeenCalled();
  });
});
