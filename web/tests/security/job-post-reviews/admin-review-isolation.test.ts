import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Administrator review isolation", () => {
  it("keeps routes service-only and projections free of contact/evidence data", () => {
    const routes = [
      "src/app/api/admin/job-post-reviews/route.ts",
      "src/app/api/admin/job-post-reviews/[reviewId]/route.ts",
      "src/app/api/admin/job-post-reviews/[reviewId]/[action]/route.ts",
    ]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    expect(routes).not.toMatch(
      /backend\/(?:database|repositories)|generated\/prisma/u,
    );
    const contract = readFileSync(
      "src/shared/contracts/admin/job-post-review.ts",
      "utf8",
    );
    expect(contract).not.toMatch(/email|phone|challengeSecret/u);
  });
});
