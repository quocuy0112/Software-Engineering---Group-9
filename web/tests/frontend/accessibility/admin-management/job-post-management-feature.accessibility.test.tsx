import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/frontend/features/admin/job-post-management/job-post-management-action-panel.tsx",
  "utf8",
);

describe("featured placement accessibility", () => {
  it("labels each scheduling input", () => {
    expect(source).toContain('label="Placement"');
    expect(source).toContain('label="Priority"');
    expect(source).toContain("InputLabelProps");
  });
});
