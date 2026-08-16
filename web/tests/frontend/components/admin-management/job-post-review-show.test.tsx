import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Administrator job-post review detail", () => {
  it("renders the submitted content as structured review sections instead of raw JSON", () => {
    const source = readFileSync(
      "src/frontend/features/admin/job-post-reviews/job-post-review-show.tsx",
      "utf8",
    );

    for (const marker of [
      "Submitted job posting",
      "Responsibilities",
      "Version comparison",
      "Review context",
      "Immutable history",
      "JobPostReviewActionPanel",
    ]) {
      expect(source).toContain(marker);
    }

    expect(source).not.toContain("<pre>");
    expect(source).not.toContain("JSON.stringify");
  });
});
