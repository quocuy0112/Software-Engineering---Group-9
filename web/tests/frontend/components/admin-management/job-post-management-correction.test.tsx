import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/frontend/features/admin/job-post-management/job-post-management-action-panel.tsx",
  "utf8",
);

describe("administrator correction controls", () => {
  it("requires a recruiter-visible explanation before requesting changes", () => {
    expect(source).toContain("Recruiter-visible correction request");
    expect(source).toContain("explanation.trim().length < 20");
    expect(source).toContain("REQUEST_CHANGES");
  });
});
