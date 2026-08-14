import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  companyEmailChallengeSchema,
  companyEmailConfirmationSchema,
} from "@/shared/contracts/employer-verification/business-verification";

describe("company email challenge HTTP contract", () => {
  it("keeps issue asynchronous and confirmation token-only", () => {
    const issue = readFileSync(
      "src/app/api/employer-verifications/company-email/challenges/route.ts",
      "utf8",
    );
    const confirm = readFileSync(
      "src/app/api/employer-verifications/company-email/confirm/route.ts",
      "utf8",
    );
    expect(issue).toContain("status: 202");
    expect(issue).toContain("private, no-store");
    expect(confirm).toContain("private, no-store");
    expect(companyEmailChallengeSchema.safeParse({ preparationVersion: 1, email: "hr@example.vn" }).success).toBe(true);
    expect(companyEmailConfirmationSchema.safeParse({ token: "x".repeat(43), email: "must-not-pass@example.vn" }).success).toBe(false);
  });
});
