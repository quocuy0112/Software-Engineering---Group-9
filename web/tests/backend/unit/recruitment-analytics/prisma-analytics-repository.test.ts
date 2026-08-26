import { describe, expect, it, vi } from "vitest";
import { PrismaAnalyticsRepository } from "@/backend/repositories/analytics/prisma-analytics-repository";

describe("PrismaAnalyticsRepository analytics baseline", () => {
  it("uses the persisted migration time when no lifecycle fact exists", async () => {
    const migrationBaseline = new Date("2026-08-20T09:00:00.000Z");
    const findFirst = vi.fn().mockResolvedValue(null);
    const queryRaw = vi
      .fn()
      .mockResolvedValue([{ finishedAt: migrationBaseline }]);
    const repository = new PrismaAnalyticsRepository({
      jobPostingLifecycleFact: { findFirst },
      $queryRaw: queryRaw,
    } as never);

    const first = await repository.analyticsAvailableFrom();
    const second = await repository.analyticsAvailableFrom();

    expect(first).toEqual(migrationBaseline);
    expect(second).toEqual(migrationBaseline);
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});
