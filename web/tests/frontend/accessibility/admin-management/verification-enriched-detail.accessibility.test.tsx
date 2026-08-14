import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("administrator verification detail accessibility", () => {
  it("uses headings and text labels rather than color alone", () => {
    const panel = readFileSync(
      "src/frontend/features/admin/verification/verification-business-facts-panel.tsx",
      "utf8",
    );
    expect(panel).toContain('component="h2"');
    for (const label of [
      "Registry snapshot stale",
      "Legacy request",
      "Email verified",
      "Phone unverified",
      "differs",
      "Not available",
    ]) {
      expect(panel).toContain(label);
    }
  });
});
