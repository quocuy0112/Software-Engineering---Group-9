import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Administrator review projections", () => {
  it("orders unassigned work first and exposes bounded safe context", () => {
    const repository = readFileSync(
      "src/backend/repositories/jobs/prisma-job-post-review-repository.ts",
      "utf8",
    );
    const service = readFileSync(
      "src/backend/jobs/review/job-post-review-service.ts",
      "utf8",
    );
    expect(repository).toContain("assignedAdminUserId");
    expect(repository).toContain("submittedAt");
    expect(repository).toContain("submittedBefore");
    expect(repository).toContain("sequence");
    expect(service).toContain("jobPostReviewDetailSchema");
    expect(service).toContain("calculatedAt");
    expect(service).not.toMatch(
      /submittedBy\.email|company\.normalizedTaxIdentifier/u,
    );
  });
});
