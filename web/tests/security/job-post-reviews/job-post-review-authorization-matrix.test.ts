import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("job-post review authorization matrix", () => {
  it("uses the existing sensitive Administrator boundary and exact command/path binding", () => {
    const route = readFileSync(
      "src/app/api/admin/job-post-reviews/[reviewId]/[action]/route.ts",
      "utf8",
    );
    expect(route).toContain("new AdminRequestBoundary().require(request, {");
    expect(route).toContain("sensitive: true");
    expect(route).toContain("COMMAND_PATH_MISMATCH");
    expect(route).toContain("strictIfMatch: true");
    expect(route).toContain("idempotencyKey");
  });

  it("rejects malformed or stale commands before service mutation", () => {
    const route = readFileSync(
      "src/app/api/admin/job-post-reviews/[reviewId]/[action]/route.ts",
      "utf8",
    );
    expect(route).toContain("TARGET_UNAVAILABLE");
    expect(route).toContain("VALIDATION_FAILED");
    expect(route).toContain("expectedVersion < 1");
    expect(route.indexOf("VALIDATION_FAILED")).toBeLessThan(
      route.indexOf("new JobPostReviewService()"),
    );
  });

  it("does not introduce a second browser session owner or client-authored lifecycle route", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema.match(/^model Session \{/gmu)).toHaveLength(1);
    const route = readFileSync(
      "src/app/api/admin/job-post-reviews/[reviewId]/[action]/route.ts",
      "utf8",
    );
    expect(route).not.toMatch(/status|approvalComment|assignedAdminUserId/iu);
  });
});
