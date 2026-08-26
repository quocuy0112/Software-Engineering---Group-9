import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Administrator review discovery accessibility", () => {
  it("labels filters/actions and announces assignment changes", () => {
    const source = [
      "job-post-review-list.tsx",
      "job-post-review-action-panel.tsx",
    ]
      .map((name) =>
        readFileSync(
          `src/frontend/features/admin/job-post-reviews/${name}`,
          "utf8",
        ),
      )
      .join("\n");
    expect(source).toContain("aria-label");
    expect(source).toContain('role="status"');
    expect(source).toContain("onFocus");
  });
});
