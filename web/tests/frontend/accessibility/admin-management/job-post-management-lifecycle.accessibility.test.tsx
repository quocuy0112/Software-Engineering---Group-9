import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/frontend/features/admin/job-post-management/job-post-management-action-panel.tsx",
  "utf8",
);

describe("job post lifecycle accessibility", () => {
  it("uses labelled controls and an explicit confirmation dialog", () => {
    expect(source).toContain('label="Operational reason"');
    expect(source).toContain("DialogTitle");
    expect(source).toContain("DialogContentText");
  });
});
