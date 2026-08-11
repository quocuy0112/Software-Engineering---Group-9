import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("moderation isolation and privacy", () => {
  const submission = readFileSync(
    resolve(
      process.cwd(),
      "src/backend/admin/moderation/moderation-submission-service.ts",
    ),
    "utf8",
  );
  const review = readFileSync(
    resolve(
      process.cwd(),
      "src/backend/admin/moderation/moderation-review-service.ts",
    ),
    "utf8",
  );

  it("does not mutate enforcement domains during submission or moderation-only review", () => {
    for (const source of [submission, review]) {
      expect(source).not.toMatch(/jobPosting\.(?:update|delete)/u);
      expect(source).not.toMatch(/userAccount\.(?:update|delete)/u);
      expect(source).not.toMatch(/companyMembership\.(?:update|delete)/u);
      expect(source).not.toMatch(/jobApplication\.(?:update|delete)/u);
    }
  });

  it("does not create security notification work for moderation-only commands", () => {
    expect(review).not.toContain("securityNotificationWork.create");
    expect(review).not.toContain("privateDetail");
  });
});
