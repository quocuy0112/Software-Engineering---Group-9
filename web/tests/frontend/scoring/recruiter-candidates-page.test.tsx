import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  RecruiterCompanyView,
  RecruiterJob,
} from "@/shared/contracts/recruiter-job-posting";
import { RecruiterCandidatesPage } from "@/frontend/features/recruiter-applications/recruiter-candidates-page";

vi.mock(
  "@/frontend/features/recruiter-applications/use-campaign-scoring-stats",
  () => ({
    useCampaignScoringStats: () => ({
      stats: {},
      error: null,
      loading: false,
    }),
  }),
);

function makeJobs(count: number): RecruiterJob[] {
  return Array.from(
    { length: count },
    (_, index) =>
      ({
        id: `job-${index + 1}`,
        title: `Campaign ${index + 1}`,
        status: "active",
        updatedAt: "2026-08-15T00:00:00.000Z",
        stats: { applicantCount: count - index },
        company: { name: "SmartHire" },
        categoryFamily: "Engineering",
        industry: "Technology",
        description: { generalInfo: { department: "Engineering" } },
      }) as unknown as RecruiterJob,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("recruiter campaign pagination", () => {
  it("uses the job id in candidate links when job titles are duplicated", () => {
    const jobs = makeJobs(2).map((job) => ({
      ...job,
      title: "Product Designer",
    }));
    render(<RecruiterCandidatesPage jobs={jobs} />);

    const links = screen.getAllByRole("link", {
      name: "Review candidates for Product Designer",
    });
    expect(links[0]).toHaveAttribute("href", "/recruiter/candidates/job-1");
    expect(links[1]).toHaveAttribute("href", "/recruiter/candidates/job-2");
  });

  it("pages the campaign grid and resets to page one when filters change", () => {
    render(<RecruiterCandidatesPage jobs={makeJobs(25)} />);

    expect(screen.getAllByText("Showing 1–12 of 25 campaigns")).toHaveLength(2);
    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    expect(screen.getByText("Campaign 1")).toBeInTheDocument();
    expect(screen.queryByText("Campaign 13")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(screen.getAllByText("Showing 13–24 of 25 campaigns")).toHaveLength(
      2,
    );
    expect(screen.getByText("Campaign 13")).toBeInTheDocument();
    expect(screen.queryByText("Campaign 1")).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText("Search by role, company, or department"),
      {
        target: { value: "Campaign 25" },
      },
    );
    expect(screen.getAllByText("Showing 1–1 of 1 campaigns")).toHaveLength(2);
    expect(screen.getByText("Campaign 25")).toBeInTheDocument();
  });

  it("scopes campaigns to the selected company", () => {
    const companies = [
      {
        id: "company-1",
        slug: "smart-hire",
        name: "SmartHire",
        logo: null,
        size: "1-50 employees",
        industry: "Technology",
        address: "Ho Chi Minh City",
        website: null,
        description: null,
        ownerUserId: "recruiter-1",
        memberUserIds: [],
        role: "OWNER" as const,
      },
      {
        id: "company-2",
        slug: "northstar",
        name: "Northstar Labs",
        logo: null,
        size: "51-200 employees",
        industry: "Technology",
        address: "Hanoi",
        website: null,
        description: null,
        ownerUserId: "recruiter-1",
        memberUserIds: [],
        role: "OWNER" as const,
      },
    ] satisfies RecruiterCompanyView[];
    const jobs = makeJobs(2).map((job, index) => ({
      ...job,
      companyId: companies[index]!.id,
      company: {
        ...job.company,
        name: companies[index]!.name,
      },
    }));

    render(<RecruiterCandidatesPage jobs={jobs} companies={companies} />);

    const companyFilter = screen.getByLabelText("Company");
    expect(companyFilter).toHaveValue("all");
    expect(screen.getByText("Campaign 1")).toBeInTheDocument();
    expect(screen.getByText("Campaign 2")).toBeInTheDocument();

    fireEvent.change(companyFilter, { target: { value: "company-2" } });

    expect(screen.queryByText("Campaign 1")).not.toBeInTheDocument();
    expect(screen.getByText("Campaign 2")).toBeInTheDocument();
  });
});
