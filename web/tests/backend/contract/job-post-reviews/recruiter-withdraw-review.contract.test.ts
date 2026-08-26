import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  "src/app/api/recruiter/job-postings/[jobId]/withdraw-review/route.ts",
  "utf8",
);
const service = readFileSync(
  "src/backend/jobs/review/job-post-review-service.ts",
  "utf8",
);
const stateConstraintMigration = readFileSync(
  "prisma/migrations/070_recruiter_job_withdrawal_state_constraint/migration.sql",
  "utf8",
);

describe("Recruiter withdraw-review contract", () => {
  it("uses the protected mutation boundary and tenant-scoped service", () => {
    expect(route).toContain("requireJobActor(request, { mutation: true })");
    expect(route).toContain("withdrawRecruiterJobReview");
    expect(route).toContain('searchParams.get("industryCode")');
    expect(route).toContain("JOB_POST_REVIEW_CONFLICT");
  });

  it("ends pending review without deleting the immutable review history", () => {
    expect(service).toContain('state: "WITHDRAWN"');
    expect(service).toContain('action: "WITHDRAWN"');
    expect(service).toContain('action: "job_post_review.withdrawn"');
    expect(service).toContain("pendingVersionId: null");
  });

  it("allows withdrawn rows through the review state database constraint", () => {
    expect(stateConstraintMigration).toContain(
      'DROP CONSTRAINT "JobPostReviewVersion_state_fields_check"',
    );
    expect(stateConstraintMigration).toContain("\"state\" = 'WITHDRAWN'");
    expect(stateConstraintMigration).toContain(
      '"decidedByAdminUserId" IS NULL',
    );
    expect(stateConstraintMigration).toContain('"decidedAt" IS NOT NULL');
  });
});
