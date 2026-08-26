import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Recruiter review submission accessibility", () => {
  it("uses live semantic state and non-color pending lock cues", () => {
    const management = readFileSync(
      "src/frontend/features/recruiter-workspace/job-posting-management.tsx",
      "utf8",
    );
    const styles = readFileSync(
      "src/frontend/styles/recruiter-workspace-full.css",
      "utf8",
    );
    expect(management).toContain('role="status"');
    expect(management).toContain("locked while an Administrator reviews it");
    expect(styles).toContain("border: 1px solid currentColor");
    expect(styles).toContain("@media (max-width: 640px)");
  });
});
