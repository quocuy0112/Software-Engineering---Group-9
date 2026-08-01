import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { PrismaSystemReadinessRepository } from "@/backend/repositories/system/prisma-system-readiness-repository";

describe("system readiness route", () => {
  it("reports ready only against the current required schema", async () => {
    await expect(
      new PrismaSystemReadinessRepository().schemaReady(),
    ).resolves.toBe(true);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
