import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/frontend/features/recruiter-workspace/job-posting-management.tsx",
  "utf8",
);

describe("recruiter correction context", () => {
  it("shows the explanation and preserves the live-version guidance", () => {
    expect(source).toContain("Administrator requested changes");
    expect(source).toContain("correctionRequest.publicExplanation");
    expect(source).toContain("approved version remains live");
  });
});
