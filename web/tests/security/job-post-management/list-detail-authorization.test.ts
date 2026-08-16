import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync(
  "src/backend/jobs/management/job-post-management-service.ts",
  "utf8",
);

describe("managed job reads", () => {
  it("requires an active, unexpired moderator grant before list and detail", () => {
    expect(service).toContain('state: "ACTIVE"');
    expect(service).toContain("expiresAt: { gt: new Date() }");
    expect(service).toContain(
      'this.assertScope(authority, "JOB_POST_MODERATE")',
    );
    expect(service).toContain("userId: authority.userId");
  });
});
