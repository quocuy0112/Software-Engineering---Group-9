import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/frontend/features/admin/job-post-management/job-post-management-list.tsx",
  "utf8",
);

describe("job post management list", () => {
  it("exposes dense discoverability filters and row navigation", () => {
    expect(source).toContain("Search title, company, recruiter");
    expect(source).toContain("applicationState");
    expect(source).toContain("reportState");
    expect(source).toContain('rowClick="show"');
  });
});
