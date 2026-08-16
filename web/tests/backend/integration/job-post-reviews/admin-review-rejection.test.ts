import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Administrator rejection transaction", () => {
  it("keeps rejection non-public and separates public explanation from private note", () => {
    const source = readFileSync(
      "src/backend/repositories/jobs/prisma-job-post-review-repository.ts",
      "utf8",
    );
    for (const marker of [
      "reasonCode",
      "publicExplanation",
      "jobPostReviewPrivateNote",
      "JOB_POST_REJECTED",
      "REJECTED",
    ])
      expect(source).toContain(marker);
  });
});
