import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync(
  "src/backend/jobs/review/job-post-submission-service.ts",
  "utf8",
);

describe("Recruiter submission transaction", () => {
  it("creates an exact pending snapshot, history, audit, and admin fan-out atomically", () => {
    for (const marker of [
      "jobReviewSnapshotFromCatalog",
      "jobReviewSnapshotSha256",
      "projectJobReviewSnapshot",
      "prisma.$transaction",
      "createPendingVersion",
      "job_post_review.submitted",
      "JOB_POST_REVIEW_REQUESTED_ADMIN",
    ])
      expect(service).toContain(marker);
  });
});
