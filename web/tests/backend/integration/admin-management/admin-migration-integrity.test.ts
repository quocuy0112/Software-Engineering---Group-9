import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Feature 006 additive migration", () => {
  const migration = readFileSync(
    "prisma/migrations/016_admin_management/migration.sql",
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
        "prisma/migrations/020_verification_outbox_event_unique/migration.sql",
        "utf8",
      ),
    ).toContain("EmailOutbox_verification_event_unique");
  });

  it("adds provider-truth notification linkage without rewriting old keys", () => {
    const providerTruthMigration = readFileSync(
      "prisma/migrations/021_security_notification_provider_truth/migration.sql",
      "utf8",
    );
    const reconciliation = readFileSync(
      "scripts/reconcile-security-notifications.mjs",
      "utf8",
    );
    expect(providerTruthMigration).toContain('ADD COLUMN "emailOutboxId"');
    expect(providerTruthMigration).toContain('ADD COLUMN "opsAlertedAt"');
    expect(providerTruthMigration).not.toMatch(/^\s*UPDATE\s/imu);
    expect(reconciliation).toContain("'security-work:' || work.\"id\"");
    expect(reconciliation).toContain("WHEN 'SENT' THEN 'DELIVERED'");
    expect(reconciliation).toContain("NO_LEGACY_OUTBOX_MATCH");
    expect(reconciliation).not.toMatch(
      /SET\s+"idempotencyKey"|UPDATE\s+"EmailOutbox"/u,
    );
  });
});
