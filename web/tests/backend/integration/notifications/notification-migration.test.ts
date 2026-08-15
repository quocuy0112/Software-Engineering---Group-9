import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/032_unified_in_app_notifications/migration.sql",
  "utf8",
);
const compatibilityMigration = readFileSync(
  "prisma/migrations/031_smarthire/migration.sql",
  "utf8",
);
const adminActionableMigration = readFileSync(
  "prisma/migrations/035_actionable_admin_notifications/migration.sql",
  "utf8",
);

describe("unified notification migration", () => {
  it("is additive, constrained, indexed, and idempotently backfills connections", () => {
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS "InAppNotification"',
    );
    expect(migration).toContain("InAppNotification_context_pair_check");
    expect(migration).toContain("InAppNotification_occurrence_count_check");
    expect(migration).toContain("InAppNotification_internal_href_check");
    expect(migration).toContain('ON CONFLICT ("deduplicationKey") DO NOTHING');
    expect(migration).toContain('n."deduplicationKey"');
    expect(migration).toContain('REFERENCES "user"("id")');
    expect(migration).toContain("WHERE NOT EXISTS (");
    expect(migration).toContain("EXCEPTION WHEN duplicate_object THEN NULL");
    expect(migration).not.toMatch(/DROP\s+TABLE/iu);
  });

  it("keeps the generated 031 migration history alias explicit", () => {
    const migrationMap = readFileSync("scripts/migration-name-map.mjs", "utf8");
    expect(migrationMap).toContain(
      '["20260814131732_smarthire", "031_smarthire"]',
    );
    expect(migrationMap).toContain(
      "37bfd88f3db24b583690dfff1df684d1be77477665f105d21c111abc3dfd1e43",
    );
  });

  it("does not replay schema objects already owned by earlier migrations", () => {
    expect(compatibilityMigration).toContain("SELECT 1;");
    expect(compatibilityMigration).not.toMatch(
      /CREATE\s+(TYPE|TABLE)|ALTER\s+TABLE/iu,
    );
  });

  it("adds only the allow-listed actionable administrator enum values", () => {
    for (const kind of [
      "SUPPORT_CASE_RECEIVED",
      "SUPPORT_REQUESTER_REPLIED",
      "SUPPORT_CASE_REOPENED",
      "MESSAGE_REPORT_RECEIVED_ADMIN",
      "MODERATION_REPORT_RECEIVED_ADMIN",
      "VERIFICATION_REVIEW_OVERDUE",
      "DELIVERY_MANUAL_INTERVENTION_REQUIRED",
    ]) {
      expect(adminActionableMigration).toContain(`'${kind}'`);
    }
    expect(adminActionableMigration).not.toMatch(
      /DROP\s+(TABLE|TYPE|COLUMN)/iu,
    );
  });
});
