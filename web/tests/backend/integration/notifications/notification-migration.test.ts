import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/032_unified_in_app_notifications/migration.sql",
  "utf8",
);
const adminActionableMigration = readFileSync(
  "prisma/migrations/036_actionable_admin_notifications/migration.sql",
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

  it("removes the obsolete 031 migration from the canonical sequence", () => {
    const migrationMap = readFileSync("scripts/migration-name-map.mjs", "utf8");
    expect(existsSync("prisma/migrations/031_smarthire")).toBe(false);
    expect(migrationMap).toContain("obsoleteMigrationNames");
    expect(migrationMap).toContain('"031_smarthire"');
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
