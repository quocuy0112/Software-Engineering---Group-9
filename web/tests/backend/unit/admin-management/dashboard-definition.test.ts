import { describe, expect, it } from "vitest";
import {
  DASHBOARD_MAX_AGE_MS,
  DASHBOARD_REFRESH_MS,
  DASHBOARD_STATE_DEFINITION_VERSION,
  dashboardDefinition,
} from "@/backend/admin/dashboard/dashboard-definition";
import { ADMIN_STATE_DEFINITION_VERSION } from "@/shared/contracts/admin/common";

describe("dashboard definition", () => {
  it("uses one definition version for snapshots and drill-down lists", () => {
    expect(DASHBOARD_STATE_DEFINITION_VERSION).toBe(
      ADMIN_STATE_DEFINITION_VERSION,
    );
    expect(DASHBOARD_REFRESH_MS).toBe(30_000);
    expect(DASHBOARD_MAX_AGE_MS).toBe(60_000);
  });

  it("distinguishes people, accounts, memberships, requests, and reports", () => {
    expect(dashboardDefinition.candidateActive.unit).toBe("PEOPLE");
    expect(dashboardDefinition.recruiterEnabledAccounts.unit).toBe("ACCOUNTS");
    expect(dashboardDefinition.recruiterMemberships.unit).toBe("MEMBERSHIPS");
    expect(dashboardDefinition.pendingVerificationRequests.unit).toBe(
      "REQUESTS",
    );
    expect(dashboardDefinition.pendingModerationReports.unit).toBe("REPORTS");
    expect(dashboardDefinition.securityNotificationsManualIntervention).toEqual(
      {
        unit: "NOTIFICATIONS",
        filter: { notificationStatus: "MANUAL_INTERVENTION_REQUIRED" },
      },
    );
  });
});
