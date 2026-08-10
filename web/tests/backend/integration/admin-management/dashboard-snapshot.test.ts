import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import {
  DashboardSnapshotService,
  DashboardSnapshotUnavailableError,
} from "@/backend/admin/dashboard/dashboard-snapshot-service";
import { DASHBOARD_STATE_DEFINITION_VERSION } from "@/backend/admin/dashboard/dashboard-definition";

describe("dashboard snapshot age", () => {
  afterEach(() => prisma.adminDashboardSnapshot.deleteMany());

  it("returns the newest unexpired immutable snapshot", async () => {
    const now = new Date("2026-08-10T09:00:00.000Z");
    await prisma.adminDashboardSnapshot.createMany({
      data: [
        {
          calculatedAt: new Date(now.getTime() - 20_000),
          expiresAt: new Date(now.getTime() + 40_000),
          stateDefinitionVersion: DASHBOARD_STATE_DEFINITION_VERSION,
          metrics: {},
        },
        {
          calculatedAt: new Date(now.getTime() - 10_000),
          expiresAt: new Date(now.getTime() + 50_000),
          stateDefinitionVersion: DASHBOARD_STATE_DEFINITION_VERSION,
          metrics: {},
        },
      ],
    });
    const current = await new DashboardSnapshotService().current(now);
    expect(current.calculatedAt).toBe("2026-08-10T08:59:50.000Z");
  });

  it("rejects an expired snapshot instead of presenting stale counts", async () => {
    const now = new Date("2026-08-10T09:00:00.000Z");
    await prisma.adminDashboardSnapshot.create({
      data: {
        calculatedAt: new Date(now.getTime() - 61_000),
        expiresAt: new Date(now.getTime() - 1_000),
        stateDefinitionVersion: DASHBOARD_STATE_DEFINITION_VERSION,
        metrics: {},
      },
    });
    await expect(
      new DashboardSnapshotService().current(now),
    ).rejects.toBeInstanceOf(DashboardSnapshotUnavailableError);
  });
});
