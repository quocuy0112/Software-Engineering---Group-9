import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { JobPerformanceReport } from "@/shared/contracts/analytics/employer";
import { HiringFunnel } from "@/frontend/features/recruitment-analytics/hiring-funnel";

const stages: JobPerformanceReport["funnel"][number]["stage"][] = [
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "INTERVIEWING",
  "OFFERED",
  "HIRED",
  "OFFER_DECLINED",
  "REJECTED",
  "WAITLISTED",
];

function reportWithCounts(
  counts: Partial<
    Record<JobPerformanceReport["funnel"][number]["stage"], number>
  >,
): JobPerformanceReport {
  const total = stages.reduce((sum, stage) => sum + (counts[stage] ?? 0), 0);
  return {
    metadata: {
      from: "2026-08-20T00:00:00+07:00",
      to: "2026-08-21T00:00:00+07:00",
      timeZone: "Asia/Ho_Chi_Minh",
      dataCutoff: "2026-08-21T00:00:00+07:00",
      definitionVersion: "recruitment-analytics-v1",
      analyticsAvailableFrom: "2026-01-01T00:00:00+07:00",
    },
    job: { id: "job-1", title: "Game Development" },
    qualifiedViews: 40,
    submittedApplications: counts.APPLIED ?? 0,
    conversionRate: {
      numerator: counts.APPLIED ?? 0,
      denominator: 40,
      value: ((counts.APPLIED ?? 0) / 40) * 100,
      availability: "AVAILABLE",
    },
    funnelAsOf: "2026-08-21T00:00:00+07:00",
    funnel: stages.map((stage) => ({
      stage,
      count: counts[stage] ?? 0,
      percentage: total === 0 ? 0 : ((counts[stage] ?? 0) / total) * 100,
    })),
  };
}

describe("HiringFunnel", () => {
  it("renders candidate counts and percentages for every recruitment stage", () => {
    render(
      <HiringFunnel
        report={reportWithCounts({ APPLIED: 3, INTERVIEWING: 1 })}
        jobTitle="Game Development"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Hiring funnel" }),
    ).toBeVisible();
    expect(screen.getAllByText("Applied")[0]).toBeVisible();
    expect(screen.getAllByText("3")[0]).toBeVisible();
    expect(screen.getByText("75.00% of pipeline")).toBeVisible();
    expect(screen.getAllByText("Interviewing")[0]).toBeVisible();
    expect(screen.getByText("25.00% of pipeline")).toBeVisible();
    expect(
      screen.getByRole("progressbar", {
        name: "Applied percentage of candidate pipeline",
      }),
    ).toHaveAttribute("aria-valuenow", "75");
  });

  it("shows the empty state when no candidate stages contain data", () => {
    render(
      <HiringFunnel
        report={reportWithCounts({})}
        jobTitle="Game Development"
      />,
    );

    expect(
      screen.getByText("No applications yet for this job posting."),
    ).toBeVisible();
  });
});
