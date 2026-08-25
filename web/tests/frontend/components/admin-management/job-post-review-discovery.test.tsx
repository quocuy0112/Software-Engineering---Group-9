import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Administrator review discovery UI", () => {
  it("provides queue, detail, claim, reassignment, and stale recovery", () => {
    const source = [
      "job-post-review-list.tsx",
      "job-post-review-show.tsx",
      "job-post-review-action-panel.tsx",
    ]
      .map((name) =>
        readFileSync(
          `src/frontend/features/admin/job-post-reviews/${name}`,
          "utf8",
        ),
      )
      .join("\n");
    for (const marker of [
      "Claim",
      "Reassign",
      "PENDING_REVIEW",
      "STALE_CONFLICT",
      "Minimum pending age in hours",
      "Submission version",
      "Version comparison",
      "Open protected verification viewer",
      "Deleted archive",
      "WITHDRAWN",
      'state: "PENDING_REVIEW"',
    ])
      expect(source).toContain(marker);
  });
});
