import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const service = readFileSync(
  resolve(
    process.cwd(),
    "src/backend/jobs/management/job-post-management-service.ts",
  ),
  "utf8",
);

describe("job post management privacy", () => {
  it("does not return reporter identities in administrator job detail", () => {
    expect(service).toContain("distinctReporterCount");
    expect(service).toMatch(/reports: reports\.map\([\s\S]*id: report\.id/u);
    expect(service).not.toMatch(
      /reports: reports\.map\([\s\S]*reporterUserId/u,
    );
  });

  it("requires an active scoped grant for all management reads and writes", () => {
    expect(service).toContain('state: "ACTIVE"');
    expect(service).toContain("scopes: { some: { scope } }");
    expect(service).toContain("jobPostManagementScope[command.command]");
  });
});
