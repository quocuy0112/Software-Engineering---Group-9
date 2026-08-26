import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyJobPosting } from "@/shared/contracts/recruiter-job-posting";
import type {
  RecruiterCompanyView,
  RecruiterJob,
} from "@/shared/contracts/recruiter-job-posting";
import { RecruiterPipelinePage } from "@/frontend/features/recruiter-applications/recruiter-pipeline-page";

vi.mock(
  "@/frontend/features/recruiter-applications/recruitment-pipeline-board",
  () => ({
    RecruitmentPipelineBoard: ({ jobId }: { jobId: string }) => (
      <div data-testid="pipeline-board">Pipeline for {jobId}</div>
    ),
  }),
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

function makeJob(company: RecruiterCompanyView, id: string, title: string) {
  const job = createEmptyJobPosting(company.id);
  return {
    ...job,
    id,
    slug: id,
    title,
    status: "active" as const,
    company,
  } satisfies RecruiterJob;
}

describe("recruiter pipeline company scope", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("scopes the managed job selector to the selected company", () => {
    const firstCompany = makeCompany("company-1", "SmartHire");
    const secondCompany = makeCompany("company-2", "Northstar Labs");
    const firstJob = makeJob(firstCompany, "job-1", "Product Designer");
    const secondJob = makeJob(secondCompany, "job-2", "Backend Engineer");

    render(
      <RecruiterPipelinePage
        jobs={[firstJob, secondJob]}
        companies={[firstCompany, secondCompany]}
        initialJobId="job-1"
      />,
    );

    const companyFilter = screen.getByLabelText("Company");
    const jobFilter = screen.getByLabelText("Job posting");
    expect(companyFilter).toHaveValue("all");
    expect(jobFilter).toHaveValue("job-1");
    expect(
      screen.getByRole("option", { name: /Product Designer/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Backend Engineer/ }),
    ).toBeInTheDocument();

    fireEvent.change(companyFilter, { target: { value: "company-2" } });

    expect(jobFilter).toHaveValue("job-2");
    expect(
      screen.queryByRole("option", { name: /Product Designer/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Backend Engineer/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-board")).toHaveTextContent(
      "Pipeline for job-2",
    );
  });
});
