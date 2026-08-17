import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/frontend/features/admin/job-post-management/job-post-management-list.tsx",
  "utf8",
);

describe("job post management list accessibility", () => {
  it("uses labelled React Admin fields rather than color-only state", () => {
    expect(source).toContain('label="Applications"');
    expect(source).toContain('label="Reports"');
    expect(source).toContain("BooleanField");
  });
});
