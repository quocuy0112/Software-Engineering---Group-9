import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("enriched submission concurrency guards", () => {
  it("maps both idempotency and active-request unique conflicts safely", () => {
    const service = readFileSync(
      "src/backend/admin/verification/applicant-verification-service.ts",
      "utf8",
    );
    const migration = readFileSync(
      "prisma/migrations/016_admin_management/migration.sql",
      "utf8",
    );
    expect(service).toContain('error.code === "P2002"');
    expect(service).toContain("submissionIdempotencyKey: idempotencyKey");
    expect(service).toContain(
      'throw new Error("ACTIVE_REQUEST_EXISTS", { cause: error })',
    );
    expect(service).toContain("await storage().delete(stored.storageLocator)");
    expect(migration).toContain("RecruiterVerificationRequest_active_applicant_tax_key");
  });
});
