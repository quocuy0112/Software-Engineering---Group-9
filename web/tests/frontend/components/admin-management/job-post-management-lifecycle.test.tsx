import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/frontend/features/admin/job-post-management/job-post-management-action-panel.tsx",
  "utf8",
);

describe("job post lifecycle actions", () => {
  it("requires confirmation and a reason for destructive lifecycle commands", () => {
    expect(source).toContain("Operational reason");
    expect(source).toContain("confirmation: true");
    expect(source).toContain("Close applications");
    expect(source).toContain("Archive this job post");
  });
});
