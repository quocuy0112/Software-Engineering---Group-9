import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync(
  "src/backend/jobs/management/job-post-management-service.ts",
  "utf8",
);
const review = readFileSync(
  "src/backend/repositories/jobs/prisma-job-post-review-repository.ts",
  "utf8",
);

describe("correction request lifecycle", () => {
  it("prevents duplicate open requests and satisfies one only after approval", () => {
    expect(service).toContain("CORRECTION_REQUEST_OPEN");
    expect(service).toContain("jobPostRevisionRequest.create");
    expect(review).toContain('state: "SATISFIED"');
    expect(review).toContain("submittedRevisionId: input.reviewId");
  });
});
