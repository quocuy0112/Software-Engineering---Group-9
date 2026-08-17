import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/frontend/features/admin/job-post-management/job-post-management-action-panel.tsx",
  "utf8",
);

describe("job post enforcement controls", () => {
  it("requires report identifiers and exposes enforcement type", () => {
    expect(source).toContain("Report IDs");
    expect(source).toContain("enforcementType");
    expect(source).toContain('command: "ENFORCE"');
  });
});
