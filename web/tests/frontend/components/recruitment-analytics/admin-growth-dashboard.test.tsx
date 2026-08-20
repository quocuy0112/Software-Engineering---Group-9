import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminGrowthReport } from "@/shared/contracts/analytics/admin";
import { adminDataProvider } from "@/frontend/features/admin/app/data-provider";
import { AdminGrowthDashboard } from "@/frontend/features/admin/analytics/admin-growth-dashboard";

const report: AdminGrowthReport = {
  metadata: {
    from: "2026-08-01T00:00:00+07:00",
    to: "2026-08-21T00:00:00+07:00",
    timeZone: "Asia/Ho_Chi_Minh",
    dataCutoff: "2026-08-21T00:00:00+07:00",
    definitionVersion: "recruitment-analytics-v1",
    analyticsAvailableFrom: "2026-01-01T00:00:00+07:00",
  },
  grouping: "DAY",
  buckets: [
    {
      start: "2026-08-20T00:00:00+07:00",
      end: "2026-08-21T00:00:00+07:00",
      newRegistrations: 5,
      activePostingsAtEnd: 3,
      submittedApplications: 3,
      distinctSubmittingCandidates: 2,
      applicationsPerCandidate: {
        numerator: 3,
        denominator: 2,
        value: 150,
        availability: "AVAILABLE",
      },
      applicationSuccessRate: {
        numerator: 1,
        denominator: 3,
        value: 33.33,
        availability: "AVAILABLE",
      },
    },
    {
      start: "2026-08-21T00:00:00+07:00",
      end: "2026-08-22T00:00:00+07:00",
      newRegistrations: 3,
      activePostingsAtEnd: 4,
      submittedApplications: 5,
      distinctSubmittingCandidates: 2,
      applicationsPerCandidate: {
        numerator: 5,
        denominator: 2,
        value: 250,
        availability: "AVAILABLE",
      },
      applicationSuccessRate: {
        numerator: 1,
        denominator: 5,
        value: 20,
        availability: "AVAILABLE",
      },
    },
  ],
};

describe("AdminGrowthDashboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the admin report and renders the four requested metric views", async () => {
    const analyticsOverview = vi
      .spyOn(adminDataProvider, "analyticsOverview")
      .mockResolvedValue(report);

    render(<AdminGrowthDashboard />);

    await waitFor(() => expect(analyticsOverview).toHaveBeenCalled());
    expect(analyticsOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        grouping: "DAY",
        timeZone: "Asia/Ho_Chi_Minh",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "New user registrations" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Active job postings" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Application success rate" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Applications per candidate" }),
    ).toBeVisible();
    expect(screen.getByText("8")).toBeVisible();
    expect(screen.getByText("25.00%")).toBeVisible();
    expect(screen.getByText("2.00×")).toBeVisible();
  });

  it("shows an error and retry action when the endpoint fails", async () => {
    vi.spyOn(adminDataProvider, "analyticsOverview").mockRejectedValue(
      new Error("Analytics service unavailable"),
    );

    render(<AdminGrowthDashboard />);

    expect(
      await screen.findByText("Analytics service unavailable"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
