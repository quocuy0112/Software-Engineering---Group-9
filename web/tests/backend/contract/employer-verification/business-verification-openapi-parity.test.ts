import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  businessTaxIdentifierSchema,
  companyEmailChallengeSchema,
  companyEmailConfirmationSchema,
  enrichedVerificationSubmissionSchema,
  preparationPatchSchema,
} from "@/shared/contracts/employer-verification/business-verification";

const contract = readFileSync(
  "../spec-kit/specs/014-business-verification-enrichment/contracts/openapi.yaml",
  "utf8",
);

describe("Feature 014 OpenAPI and Zod parity", () => {
  it("keeps every implemented endpoint and privacy header in the contract", () => {
    for (const path of [
      "/api/employer-verifications/preparation",
      "/api/employer-verifications/registry-lookups",
      "/api/employer-verifications/company-email/challenges",
      "/api/employer-verifications/company-email/confirm",
      "/api/employer-verifications",
    ]) {
      expect(contract).toContain(`  ${path}:`);
    }
    expect(contract.match(/private, no-store/gu)?.length).toBeGreaterThanOrEqual(4);
    expect(contract).toContain("name: Idempotency-Key");
  });

  it("matches strict tax, challenge, patch, and submission boundaries", () => {
    expect(businessTaxIdentifierSchema.safeParse("0123456789").success).toBe(true);
    expect(businessTaxIdentifierSchema.safeParse("0123456789001").success).toBe(false);
    expect(companyEmailChallengeSchema.safeParse({ preparationVersion: 1, email: "hr@example.vn" }).success).toBe(true);
    expect(companyEmailConfirmationSchema.safeParse({ token: "x".repeat(43) }).success).toBe(true);
    expect(preparationPatchSchema.safeParse({ preparationId: "prep", version: 1, changes: { unknown: true } }).success).toBe(false);
    expect(enrichedVerificationSubmissionSchema.safeParse({ requestedRole: "OWNER" }).success).toBe(false);
  });
});
