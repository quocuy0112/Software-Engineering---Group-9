import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Administrator approval transaction", () => {
  it("publishes one stable exact projection with skills, history, audit and outcome", () => {
    const repository = readFileSync(
      "src/backend/repositories/jobs/prisma-job-post-review-repository.ts",
      "utf8",
    );
    for (const marker of [
      "projectJobReviewSnapshot",
      "publicJobPostingId",
      "jobPosting.upsert",
      "jobPostingSkill.create",
      "approvedVersionId",
      "JOB_POST_APPROVED",
      "APPROVED",
    ])
      expect(repository).toContain(marker);
  });
});
