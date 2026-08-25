import { describe, expect, it, vi } from "vitest";
import {
  distributeUnassignedPendingReviews,
  leastLoadedReviewAdministrator,
} from "@/backend/jobs/review/job-post-review-assignment";

type AssignmentDb = Parameters<typeof leastLoadedReviewAdministrator>[0];

function administrator(userId: string, pendingCount: number) {
  return {
    userId,
    user: { _count: { assignedJobPostReviews: pendingCount } },
  };
}

describe("job-post review automatic assignment", () => {
  it("selects the eligible administrator with the lowest pending workload", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        administrator("admin-b", 1),
        administrator("admin-a", 3),
      ]);
    const db = {
      platformAdministratorGrant: { findMany },
    } as unknown as AssignmentDb;

    await expect(
      leastLoadedReviewAdministrator(db, new Date("2026-08-25T00:00:00Z")),
    ).resolves.toBe("admin-b");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          state: "ACTIVE",
          scopes: { some: { scope: "JOB_POST_MODERATE" } },
        }),
      }),
    );
  });

  it("leaves the review unassigned when no eligible administrator exists", async () => {
    const db = {
      platformAdministratorGrant: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as AssignmentDb;

    await expect(
      leastLoadedReviewAdministrator(db, new Date("2026-08-25T00:00:00Z")),
    ).resolves.toBeNull();
  });

  it("distributes queued pending reviews without touching saved drafts", async () => {
    const updateMany = vi
      .fn()
      .mockImplementation(
        async ({ where }: { where: { id: { in: string[] } } }) => ({
          count: where.id.in.length,
        }),
      );
    const db = {
      platformAdministratorGrant: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            administrator("admin-a", 1),
            administrator("admin-b", 0),
          ]),
      },
      jobPostReviewVersion: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "review-1" }, { id: "review-2" }]),
        updateMany,
      },
    } as unknown as AssignmentDb;

    await expect(
      distributeUnassignedPendingReviews(db, new Date("2026-08-25T00:00:00Z")),
    ).resolves.toBe(2);
    expect(updateMany).toHaveBeenCalledTimes(2);
    for (const [command] of updateMany.mock.calls) {
      expect(command).toMatchObject({
        where: {
          state: "PENDING_REVIEW",
          assignedAdminUserId: null,
        },
      });
    }
  });
});
