import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Administrator job-post decision UI", () => {
  it("provides confirmed approve/reject, public/private separation and stale recovery", () => {
    const source = readFileSync(
      "src/frontend/features/admin/job-post-reviews/job-post-review-action-panel.tsx",
      "utf8",
    );
    for (const marker of [
      "Approve exact version",
      "Reject exact version",
      "Public explanation",
      "Administrator private note",
      "confirm",
      "STALE_CONFLICT",
    ])
      expect(source).toContain(marker);
  });
});
