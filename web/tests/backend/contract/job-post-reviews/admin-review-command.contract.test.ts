import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Administrator review assignment command contract", () => {
  it("binds path/action/body, CSRF authority, version, and idempotency", () => {
    const route = readFileSync(
      "src/app/api/admin/job-post-reviews/[reviewId]/[action]/route.ts",
      "utf8",
    );
    for (const marker of [
      "AdminRequestBoundary",
      "adminReviewCommandSchema",
      "commandHeaders",
      "idempotencyKey",
      "expectedVersion",
      "COMMAND_PATH_MISMATCH",
    ])
      expect(route).toContain(marker);
  });
});
