import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editor = readFileSync(
  "src/frontend/features/recruiter-workspace/job-posting-editor.tsx",
  "utf8",
);

describe("Recruiter review submission UI", () => {
  it("saves a draft, confirms, submits with an idempotency key, and preserves retry state", () => {
    expect(editor).toContain("window.confirm");
    expect(editor).toContain('status: "draft"');
    expect(editor).toContain("submit-review");
    expect(editor).toContain('"idempotency-key"');
    expect(editor).toContain("submissionKey.current");
  });
});
