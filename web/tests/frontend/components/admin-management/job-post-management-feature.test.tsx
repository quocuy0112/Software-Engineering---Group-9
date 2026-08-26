import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/frontend/features/admin/job-post-management/job-post-management-action-panel.tsx",
  "utf8",
);

describe("featured placement controls", () => {
  it("collects placement, time window, priority and removal evidence", () => {
    expect(source).toContain("Featured placement");
    expect(source).toContain('label="Starts"');
    expect(source).toContain('label="Ends"');
    expect(source).toContain('command: "FEATURE"');
    expect(source).toContain('command: "UNFEATURE"');
  });
});
