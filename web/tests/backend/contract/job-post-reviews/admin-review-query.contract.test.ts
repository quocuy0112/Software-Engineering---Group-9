import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const list = () =>
  readFileSync("src/app/api/admin/job-post-reviews/route.ts", "utf8");
const detail = () =>
  readFileSync(
    "src/app/api/admin/job-post-reviews/[reviewId]/route.ts",
    "utf8",
  );

describe("Administrator review query contract", () => {
  it("protects bounded no-store list and detail routes", () => {
    for (const source of [list(), detail()]) {
      expect(source).toContain("AdminRequestBoundary");
      expect(source).toContain("adminJson");
      expect(source).toContain("adminRouteError");
    }
    for (const marker of [
      "jobPostReviewListQuerySchema",
      "minimumAgeHours",
      "sequence",
      "assignment.toUpperCase()",
    ])
      expect(list()).toContain(marker);
    expect(detail()).toContain("reviewId");
  });
});
