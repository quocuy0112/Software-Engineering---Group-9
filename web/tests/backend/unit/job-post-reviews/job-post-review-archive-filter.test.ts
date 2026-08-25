import { describe, expect, it, vi } from "vitest";
import { PrismaJobPostReviewRepository } from "@/backend/repositories/jobs/prisma-job-post-review-repository";

function repository() {
  const findMany = vi.fn().mockResolvedValue([]);
  const count = vi.fn().mockResolvedValue(0);
  return {
    findMany,
    count,
    reviews: new PrismaJobPostReviewRepository({
      jobPostReviewVersion: { findMany, count },
    } as never),
  };
}

describe("administrator deleted review archive filters", () => {
  it.each([
    ["ACTIVE", { softDeletedAt: null }],
    ["DELETED", { softDeletedAt: { not: null } }],
    ["ALL", {}],
  ] as const)("maps %s to an aggregate deletion scope", async (scope, expected) => {
    const fixture = repository();

    await fixture.reviews.listReviewQueue({
      page: 1,
      perPage: 25,
      recordStatus: scope,
    });

    expect(fixture.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ aggregate: expected }),
      }),
    );
    expect(fixture.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ aggregate: expected }),
    });
  });

  it("never returns deleted aggregates from pending assignment work", async () => {
    const fixture = repository();

    await fixture.reviews.listPending({ take: 25 });

    expect(fixture.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          state: "PENDING_REVIEW",
          aggregate: { softDeletedAt: null },
        }),
      }),
    );
  });
});
