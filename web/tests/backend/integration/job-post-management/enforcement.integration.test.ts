import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync(
  "src/backend/jobs/management/job-post-management-service.ts",
  "utf8",
);

describe("job post enforcement", () => {
  it("links every resolved report to immutable enforcement evidence", () => {
    expect(service).toContain("moderationReportEnforcementLink.createMany");
    expect(service).toContain("jobPostEnforcementTarget.create");
    expect(service).toContain('state: "RESOLVED"');
    expect(service).toContain("enforcementCorrelationId: correlationId");
  });
});
