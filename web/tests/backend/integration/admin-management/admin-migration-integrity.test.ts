import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Feature 006 additive migration", () => {
  const migration = readFileSync(
    "prisma/migrations/20260810090000_admin_management/migration.sql",
    "utf8",
  );

  it("does not drop authoritative account, session, application, report, or audit tables", () => {
    for (const table of [
      "user",
      "session",
      "CandidateIdentity",
      "JobApplication",
      "JobReport",
      "AuditEvent",
    ]) {
      expect(migration).not.toContain(`DROP TABLE "${table}"`);
    }
  });

  it("preserves legacy reports while backfilling the unified queue", () => {
    expect(migration).toContain('INSERT INTO "ModerationReport"');
    expect(migration).toContain('FROM "JobReport"');
    expect(migration).not.toContain('DELETE FROM "JobReport"');
  });

  it("contains active-request and verification-event idempotency protections", () => {
    expect(migration).toContain(
      "RecruiterVerificationRequest_active_applicant_tax_key",
    );
    expect(
      readFileSync(
        "prisma/migrations/20260810130000_verification_outbox_event_unique/migration.sql",
        "utf8",
      ),
    ).toContain("EmailOutbox_verification_event_unique");
  });
});
