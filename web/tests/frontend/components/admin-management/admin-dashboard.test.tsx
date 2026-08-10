import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetricCard } from "@/frontend/features/admin/dashboard/metric-card";
import { SnapshotDifferenceNotice } from "@/frontend/features/admin/dashboard/snapshot-difference-notice";

describe("admin dashboard components", () => {
  it("labels value, unit, calculation time, and drill-down action", () => {
    const open = vi.fn();
    render(
      <MetricCard
        label="Active Candidate identities"
        value={10_000}
        unit="PEOPLE"
        calculatedAt="2026-08-10T00:00:00.000Z"
        onOpen={open}
      />,
    );
    expect(screen.getByText("10,000")).toBeVisible();
    expect(screen.getByText(/people/u)).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: /Active Candidate identities/u }),
    );
    expect(open).toHaveBeenCalledOnce();
  });

  it("shows both calculation times and counts when current data differs", () => {
    render(
      <SnapshotDifferenceNotice
        snapshotTotal={10}
        currentTotal={11}
        snapshotAt="2026-08-10T00:00:00.000Z"
        currentAt="2026-08-10T00:00:30.000Z"
      />,
    );
    expect(screen.getByText(/source data changed/i)).toBeVisible();
  });
});
