import { describe, expect, it } from "vitest";
import { messagingParticipantProjection } from "@/backend/messaging/services/apply-messaging-data-lifecycle";
import { readFileSync } from "node:fs";

describe("messaging retention and deletion policy", () => {
  it("anonymizes a deleted sender without removing their durable message identity", () => {
    expect(
      messagingParticipantProjection({
        id: "deleted-user",
        name: "Private former name",
        image: "https://example.test/private.png",
        state: "DELETED",
      }),
    ).toEqual({ id: "deleted-user", name: "Deleted user", image: null });
  });

  it("enforces a database-level 90-day evidence hold and has no message expiry column", () => {
    const migration = readFileSync("prisma/migrations/023_realtime_messaging/migration.sql", "utf8");
    expect(migration).toContain("INTERVAL '90 days'");
    const messageTable = migration.slice(
      migration.indexOf('CREATE TABLE "MessagingMessage"'),
      migration.indexOf('CREATE TABLE "UserMessagingBlock"'),
    );
    expect(messageTable).not.toMatch(/expiresAt|deletedAt|deleteAfter/u);
  });
});
