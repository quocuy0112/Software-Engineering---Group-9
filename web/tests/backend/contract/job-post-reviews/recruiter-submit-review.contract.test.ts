import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  "src/app/api/recruiter/job-postings/[jobId]/submit-review/route.ts",
  "utf8",
);

describe("Recruiter submit-review contract", () => {
  it("enforces the protected mutation boundary and strict command", () => {
    expect(route).toContain("requireJobActor(request, { mutation: true })");
    expect(route).toContain('request.headers.get("idempotency-key")');
    expect(route).toContain("submitJobReviewCommandSchema");
    expect(route).toContain("parseBoundedJson");
  });

  it("returns bounded projections and neutral conflicts through no-store JSON", () => {
    expect(route).toContain("recruiterReviewProjectionSchema.parse(result)");
    expect(route).toContain("JOB_POST_REVIEW_UNAVAILABLE");
    expect(route).toContain("currentVersion");
    expect(route).toContain("jobJson");
  });
});
