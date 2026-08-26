import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalAnalyticsStages } from "@/shared/contracts/analytics";
import type { JobPerformanceReport } from "@/shared/contracts/analytics/employer";
import {
  createEmptyJobPosting,
  type RecruiterCompanyView,
  type RecruiterJob,
} from "@/shared/contracts/recruiter-job-posting";
import { RecruiterAnalyticsOverview } from "@/frontend/features/recruitment-analytics/recruiter-analytics-overview";

const fetchJobPerformanceMock = vi.hoisted(() => vi.fn());

vi.mock("@/frontend/features/recruitment-analytics/analytics-api", () => ({
  AnalyticsApiError: class AnalyticsApiError extends Error {},
  fetchJobPerformance: fetchJobPerformanceMock,
}));
vi.mock(
  "@/frontend/features/recruitment-analytics/candidate-export-panel",
  () => ({ CandidateExportPanel: () => null }),
);
vi.mock(
  "@/frontend/features/recruitment-analytics/job-performance-report",
  () => ({ JobPerformanceReport: () => null }),
);

function makeCompany(id: string, name: string): RecruiterCompanyView {
  return {
    id,
    slug: id,
    name,
    logo: null,
    size: "1-50 employees",
    industry: "Technology",
    address: "Ho Chi Minh City",
    website: null,
    description: null,
    ownerUserId: "recruiter-1",
    memberUserIds: [],
    role: "OWNER",
  };
}

function makeJob(
  company: RecruiterCompanyView,
  id: string,
  title: string,
): RecruiterJob {
  return {
    ...createEmptyJobPosting(company.id),
    id,
    slug: id,
    title,
    status: "active",
    company,
  };
}

function makeReport(jobId: string): JobPerformanceReport {
  return {
    metadata: {
      from: "2026-08-20T00:00:00+07:00",
      to: "2026-08-21T00:00:00+07:00",
      timeZone: "Asia/Ho_Chi_Minh",
      dataCutoff: "2026-08-20T12:00:00+07:00",
      definitionVersion: "recruitment-analytics-v1",
      analyticsAvailableFrom: "2026-01-01T00:00:00+07:00",
    },
    job: { id: jobId, title: jobId },
    qualifiedViews: jobId === "job-2" ? 20 : 10,
    submittedApplications: jobId === "job-2" ? 4 : 2,
    withdrawnApplications: 0,
    conversionRate: {
      numerator: jobId === "job-2" ? 4 : 2,
      denominator: jobId === "job-2" ? 20 : 10,
      value: 20,
      availability: "AVAILABLE",
    },
    funnelAsOf: "2026-08-20T12:00:00+07:00",
    funnel: canonicalAnalyticsStages.map((stage) => ({
      stage,
      count: 0,
      percentage: 0,
    })),
  };
}

describe("recruiter analytics company scope", () => {
  afterEach(() => {
    fetchJobPerformanceMock.mockReset();
    window.sessionStorage.clear();
  });

  it("refetches overview metrics for the selected company", async () => {
    const firstCompany = makeCompany("company-1", "SmartHire");
    const secondCompany = makeCompany("company-2", "Northstar Labs");
    const jobs = [
      makeJob(firstCompany, "job-1", "Product Designer"),
      makeJob(secondCompany, "job-2", "Backend Engineer"),
    ];
    fetchJobPerformanceMock.mockImplementation((jobId: string) =>
      Promise.resolve(makeReport(jobId)),
    );

    render(
      <RecruiterAnalyticsOverview
        jobs={jobs}
        companies={[firstCompany, secondCompany]}
      />,
    );

    const companyFilter = screen.getByLabelText("Company");
    await waitFor(() =>
      expect(fetchJobPerformanceMock).toHaveBeenCalledTimes(2),
    );
    expect(companyFilter).toHaveValue("all");

    fireEvent.change(companyFilter, { target: { value: "company-2" } });

    await waitFor(() => {
      expect(fetchJobPerformanceMock.mock.calls.at(-1)?.[0]).toBe("job-2");
    });
    expect(
      within(
        screen.getByText("Active job postings").closest("article")!,
      ).getByText("1"),
    ).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Product Designer")).not.toBeInTheDocument();
  });

  it("gives the date controls the full row when the company filter is hidden", () => {
    const company = makeCompany("company-1", "SmartHire");
    const { container } = render(
      <RecruiterAnalyticsOverview jobs={[]} companies={[company]} />,
    );

    const filters = container.querySelector(
      ".recruiter-analytics-overview__filters",
    );
    expect(filters).not.toHaveClass(
      "recruiter-analytics-overview__filters--with-company",
    );
    expect(screen.queryByLabelText("Company")).not.toBeInTheDocument();
  });
});
