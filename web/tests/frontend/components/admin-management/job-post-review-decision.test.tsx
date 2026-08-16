import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Administrator job-post decision UI", () => {
  it("provides a structured MUI decision workflow with public/private separation", () => {
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
      "Review actions",
      "<Paper",
      "<TextField",
      "<Alert",
      "approvalBlockers",
      "useGetIdentity",
      "claimedByCurrentAdmin",
      "setReasonCode(event.target.value)",
    ])
      expect(source).toContain(marker);
    expect(source).not.toContain("<textarea");
    expect(source).not.toContain("<select");
  });
});
