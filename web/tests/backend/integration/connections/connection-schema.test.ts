import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("professional connection migration constraints", () => {
  const sql = readFileSync(
    "prisma/migrations/20260813130000_professional_connection_proposals/migration.sql",
    "utf8",
  );
  it("uses canonical unordered pairs and partial uniqueness", () => {
    expect(sql).toContain('"participantLowId" < "participantHighId"');
    expect(sql).toContain("ProfessionalConnectionProposal_active_pair_key");
    expect(sql).toContain("ProfessionalConnection_current_pair_key");
    expect(sql).toContain("WHERE \"state\" = 'ACCEPTED'");
  });
  it("stores exact ordinary, notification, and protected deletion deadlines", () => {
    expect(sql).toContain("ordinaryDetailHiddenAt");
    expect(sql).toContain("protectedDeleteAfter");
    expect(sql).toContain("deleteAfter");
  });
});
