import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/038_job_post_review_authority/migration.sql",
  "utf8",
);

describe("job-post review authority migration", () => {
  it("adds all review authority tables and enum values without destructive DDL", () => {
    for (const table of [
      "JobPostReviewAggregate",
      "JobPostReviewVersion",
      "JobPostReviewHistory",
      "JobPostReviewPrivateNote",
      "JobCatalogueWriteLease",
    ])
      expect(migration).toContain(`"${table}"`);
    for (const value of [
      "JOB_POST_REVIEW_REQUESTED_ADMIN",
      "JOB_POST_APPROVED",
      "JOB_POST_REJECTED",
      "JOB_POST_REVIEW",
    ])
      expect(migration).toContain(`'${value}'`);
    expect(migration).not.toMatch(/DROP\s+(TABLE|TYPE|COLUMN)/iu);
  });

  it("enforces pending, idempotency, projection ownership, and lease invariants", () => {
    for (const marker of [
      "JobPostReviewVersion_one_pending_per_aggregate_key",
      "JobPostReviewVersion_submission_actor_key",
      "JobPostReviewAggregate_publicJobPostingId_key",
      "JobPostReviewAggregate_closure_pair_check",
      "JobCatalogueWriteLease_version_check",
      "JobPostReviewVersion_snapshot_sha256_check",
    ])
      expect(migration).toContain(marker);
    expect(migration).toContain('REFERENCES "JobPosting"("id")');
    expect(migration).toContain('REFERENCES "Company"("id")');
  });
});
