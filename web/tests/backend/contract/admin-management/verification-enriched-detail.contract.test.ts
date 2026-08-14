import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("administrator enriched detail contract", () => {
  it("projects source age, differences, contacts, authority, consent, and legacy state", () => {
    const repository = readFileSync(
      "src/backend/repositories/admin/prisma-verification-repository.ts",
      "utf8",
    );
    for (const field of [
      "enrichmentStatus",
      "checkedAt",
      "expiresAt",
      "legalNameDiffers",
      "registeredAddressDiffers",
      "companyEmailVerifiedAt",
      "companyPhoneVerified",
      "relationship",
      "accuracyDeclaredAt",
      "documentConsentAt",
    ]) {
      expect(repository).toContain(field);
    }
    expect(repository).not.toMatch(/tokenDigest|recipientCiphertext/gu);
  });
});
