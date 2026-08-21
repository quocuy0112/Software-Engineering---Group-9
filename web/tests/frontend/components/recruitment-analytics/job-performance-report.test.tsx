import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { canonicalAnalyticsStages } from "@/shared/contracts/analytics";
import type { JobPerformanceReport } from "@/shared/contracts/analytics/employer";
import type { RecruiterJob } from "@/shared/contracts/recruiter-job-posting";
import { JobPerformanceReport as JobPerformanceReportPanel } from "@/frontend/features/recruitment-analytics/job-performance-report";

vi.mock(
  "@/frontend/features/recruitment-analytics/candidate-export-panel",
  () => ({
    CandidateExportPanel: () => <div>Export candidates</div>,
  }),
);

const report: JobPerformanceReport = {
  metadata: {
    from: "2026-08-20T00:00:00+07:00",
    to: "2026-08-21T00:00:00+07:00",
    timeZone: "Asia/Ho_Chi_Minh",
    dataCutoff: "2026-08-20T12:00:00+07:00",
    definitionVersion: "recruitment-analytics-v1",
    analyticsAvailableFrom: "2026-01-01T00:00:00+07:00",
  },
  job: { id: "job-1", title: "Game Development" },
  qualifiedViews: 0,
  submittedApplications: 4,
  withdrawnApplications: 1,
  conversionRate: {
    numerator: 4,
    denominator: 0,
    value: null,
    availability: "NOT_APPLICABLE",
  },
  funnelAsOf: "2026-08-20T12:00:00+07:00",
  funnel: canonicalAnalyticsStages.map((stage) => ({
    stage,
    count: stage === "APPLIED" ? 4 : 0,
    percentage: stage === "APPLIED" ? 100 : 0,
  })),
};

describe("JobPerformanceReport conversion state", () => {
  it("explains why conversion is unavailable when there are no qualified views", () => {
    render(
      <JobPerformanceReportPanel
        report={report}
        jobs={[{ id: "job-1", title: "Game Development" }] as RecruiterJob[]}
        selectedJobId="job-1"
        onSelectJob={vi.fn()}
      />,
    );

    expect(screen.getByText("View-to-application")).toBeVisible();
    expect(screen.getByText("N/A")).toBeVisible();
    expect(
      screen.getByText("No qualified views in the selected window"),
    ).toBeVisible();
  });
});
