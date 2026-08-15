import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adminReviewCommandResultSchema,
  adminReviewCommandSchema,
  jobPostReviewDetailSchema,
  jobPostReviewQueueItemSchema,
  recruiterReviewProjectionSchema,
} from "@/shared/contracts/admin/job-post-review";
import { jobReviewSnapshotSchema } from "@/shared/contracts/recruiter-job-posting";

const openapi = readFileSync(
  "../spec-kit/specs/017-admin-management-job-posting/contracts/job-post-review.openapi.yaml",
  "utf8",
);

describe("job-post review OpenAPI and runtime parity", () => {
  it("documents every protected review operation and version identity", () => {
    for (const operation of [
      "submitJobPostReview",
      "listJobPostReviews",
      "getJobPostReview",
      "changeJobPostReview",
    ])
      expect(openapi).toContain(`operationId: ${operation}`);
    expect(openapi).toContain("Externally addressable Job Review Version ID");
    expect(openapi).toContain("mismatch returns 422 without mutation");
  });

  it("keeps all runtime schemas strict", () => {
    for (const schema of [
      jobReviewSnapshotSchema,
      recruiterReviewProjectionSchema,
      jobPostReviewQueueItemSchema,
      jobPostReviewDetailSchema,
      adminReviewCommandSchema,
      adminReviewCommandResultSchema,
    ])
      expect(schema.safeParse({ unsupported: true }).success).toBe(false);
  });

  it("keeps safe bounded company and submitter display context", () => {
    expect(openapi).toContain("Current safe company display name");
    expect(openapi).toContain("no email or contact data");
    expect(openapi).toContain("additionalProperties: false");
  });
});
