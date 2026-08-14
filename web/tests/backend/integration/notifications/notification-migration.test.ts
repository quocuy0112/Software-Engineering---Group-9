import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/032_unified_in_app_notifications/migration.sql",
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
    expect(migration).toContain(
      'ON CONFLICT ("deduplicationKey") DO NOTHING',
    );
    expect(migration).toContain('n."deduplicationKey"');
    expect(migration).toContain('REFERENCES "user"("id")');
    expect(migration).toContain('WHERE NOT EXISTS (');
    expect(migration).toContain("EXCEPTION WHEN duplicate_object THEN NULL");
    expect(migration).not.toMatch(/DROP\s+TABLE/iu);
  });
});
