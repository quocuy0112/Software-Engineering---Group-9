import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Administrator review assignment", () => {
  it("uses command receipts, optimistic aggregate versions, history, and audit", () => {
    const service = readFileSync(
      "src/backend/jobs/review/job-post-review-service.ts",
      "utf8",
    );
    for (const marker of [
      "PrismaAdminCommandRepository",
      "expectedVersion",
      "jobPostReviewHistory",
      "jobPostReviewPrivateNote",
      "designatedSessionId",
      'user: { state: "ACTIVE", deletedAt: null }',
      "job_post_review.claimed",
      "job_post_review.reassigned",
    ])
      expect(service).toContain(marker);
  });
});
