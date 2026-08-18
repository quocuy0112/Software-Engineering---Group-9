import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Feature 008 migration", () => {
  const migration = readFileSync(
    "prisma/migrations/023_realtime_messaging/migration.sql",
    "utf8",
  );
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("creates the Feature 007 dependency and all durable messaging entities", () => {
    for (const name of [
      "ProfessionalConnection",
      "MessagingConversation",
      "MessagingConversationParticipant",
      "MessagingMessage",
      "UserMessagingBlock",
      "MessagingReport",
    ]) {
      expect(schema).toContain(`model ${name}`);
      expect(migration).toContain(`CREATE TABLE "${name}"`);
    }
  });

  it("enforces canonical pairs, contextual uniqueness, and retention holds", () => {
    expect(migration).toContain("ProfessionalConnection_pair_check");
    expect(migration).toContain("MessagingConversation_context_check");
    expect(migration).toContain("MessagingConversation_pair_context_key");
    expect(migration).toContain("MessagingMessage_sender_operation_key");
    expect(migration).toContain("INTERVAL '90 days'");
  });

  it("preserves user and evidence integrity with restrictive foreign keys", () => {
    expect(migration).toContain('REFERENCES "user"("id") ON DELETE RESTRICT');
    expect(migration).toContain("MessagingReport_evidence_fkey");
  });
});
