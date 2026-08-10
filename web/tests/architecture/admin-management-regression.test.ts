import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Feature 006 regression boundaries", () => {
  it("keeps the Candidate workspace mounted independently", () => {
    const proxy = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8");
    expect(proxy).toContain("CANDIDATE_ORIGIN");
    expect(proxy).toContain("ADMIN_ORIGIN");
    expect(proxy).toContain("RECRUITER_ORIGIN");
    expect(proxy.toLowerCase().replaceAll("\n", " ")).not.toMatch(
      /candidate.*admin.*grant/i,
    );
  });

  it("preserves the legacy job report route while delegating generalized admission", () => {
    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/jobs/[jobId]/reports/route.ts"),
      "utf8",
    );
    const service = readFileSync(
      resolve(process.cwd(), "src/backend/services/jobs/job-report-service.ts"),
      "utf8",
    );
    expect(route).toContain("JobReportService");
    expect(service).toContain("ModerationSubmissionService");
    expect(service).not.toMatch(/jobPosting[.](?:update|delete)/u);
  });
});
