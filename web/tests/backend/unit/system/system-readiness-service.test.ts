import { describe, expect, it } from "vitest";
import { SystemReadinessService } from "@/backend/services/system/system-readiness-service";

describe("system readiness", () => {
  it("is ready only when the required database schema is current", async () => {
    await expect(
      new SystemReadinessService({ schemaReady: async () => true }).check(),
    ).resolves.toEqual({ ready: true, status: "ok" });
    await expect(
      new SystemReadinessService({ schemaReady: async () => false }).check(),
    ).resolves.toEqual({ ready: false, status: "unavailable" });
  });

  it("fails closed without exposing a database error", async () => {
    await expect(
      new SystemReadinessService({
        schemaReady: async () => {
          throw new Error("postgresql://secret@host/database");
        },
      }).check(),
    ).resolves.toEqual({ ready: false, status: "unavailable" });
  });
});
