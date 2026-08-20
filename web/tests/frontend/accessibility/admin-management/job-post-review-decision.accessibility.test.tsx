import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Administrator job-post decision accessibility", () => {
  it("labels destructive decisions and exposes live non-color results", () => {
    const source = readFileSync(
      "src/frontend/features/admin/job-post-reviews/job-post-review-action-panel.tsx",
      "utf8",
    );
    for (const marker of [
      'role="status"',
      'aria-live="polite"',
      "aria-label",
      "Reject exact version",
      "Decision result",
      "job-post-review-decision-confirmation-title",
      "job-post-review-decision-confirmation-description",
    ])
      expect(source).toContain(marker);
  });
});
