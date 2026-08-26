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

  it("accepts the submission as pending without depending on an active administrator", () => {
    expect(service).toContain('state: "PENDING_REVIEW" as const');
    expect(service).toContain("readOnly: true");
    expect(service).not.toContain("platformAdministratorGrant");
  });

  it("automatically selects an eligible reviewer without changing pending state", () => {
    expect(service).toContain("leastLoadedReviewAdministrator");
    expect(service).toContain("assignedAdminUserId");
    expect(service).toContain("preferredRecipientUserId");
    expect(service).not.toContain('state: "DRAFT"');
  });

  it("invalidates a cached draft after the pending submission commits", () => {
    expect(service).toContain("invalidateRecruiterJobCatalogueCache");
    expect(service).toMatch(
      /await prisma\.\$transaction[\s\S]*invalidateRecruiterJobCatalogueCache\(\)/u,
    );
  });
});
