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

  it("requests a fresh two-factor proof instead of treating a protected detail as a logout", () => {
    const source = readFileSync(
      "src/frontend/features/admin/job-post-reviews/job-post-review-show.tsx",
      "utf8",
    );

    expect(source).toContain("STEP_UP_REQUIRED");
    expect(source).toContain("StepUpDialog");
    expect(source).toContain("refresh();");
    expect(source).toContain("A fresh authenticator code is required");
    expect(source).toContain("ListButton");
  });

  it("waits for the full review record before reading its submitted snapshot", () => {
    const source = readFileSync(
      "src/frontend/features/admin/job-post-reviews/job-post-review-show.tsx",
      "utf8",
    );

    expect(source).toContain("if (!record?.snapshot)");
    expect(source).toContain("Loading job post review");
  });
});
