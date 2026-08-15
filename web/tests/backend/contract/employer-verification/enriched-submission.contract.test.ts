import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("enriched multipart submission contract", () => {
  const route = readFileSync("src/app/api/employer-verifications/route.ts", "utf8");
  const service = readFileSync(
    "src/backend/admin/verification/applicant-verification-service.ts",
    "utf8",
  );

  it("requires idempotency and forwards every enriched field through Zod", () => {
    expect(route).toContain('headers.get("idempotency-key")');
    expect(service).toContain("enrichedVerificationSubmissionSchema.parse");
    for (const field of [
      "preparationId",
      "lookupSnapshotId",
      "companyPhone",
      "relationship",
      "accuracyDeclaration",
      "documentProcessingConsent",
    ]) {
      expect(route).toContain(field);
    }
  });

  it("keeps file compensation and safe stale/idempotent handling", () => {
    expect(service).toContain("submissionIdempotencyKey");
    expect(service).toContain("const evidenceStorage = storage()");
    expect(service).toContain(
      "await evidenceStorage.delete(stored.storageLocator)",
    );
    expect(service).toContain("STALE_CONFLICT");
    expect(service).not.toMatch(/console\.(?:log|info|warn).*companyEmail/gu);
  });
});
