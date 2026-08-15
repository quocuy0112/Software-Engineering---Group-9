import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync(
  "src/backend/jobs/review/job-post-submission-service.ts",
  "utf8",
);
const migration = readFileSync(
  "prisma/migrations/036_job_post_review_authority/migration.sql",
  "utf8",
);

describe("Recruiter submission concurrency", () => {
  it("binds actor keys to job, working timestamp, and content", () => {
    expect(service).toContain("submissionRequestHash");
    expect(service).toContain("expectedWorkingUpdatedAt");
    expect(service).toContain("snapshotSha256");
    expect(service).toContain("aggregate.pendingVersionId");
    expect(migration).toContain(
      "JobPostReviewVersion_one_pending_per_aggregate_key",
    );
    expect(migration).toContain("JobPostReviewVersion_submission_actor_key");
  });
});
