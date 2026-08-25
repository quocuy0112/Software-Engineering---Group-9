import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecruiterJobPostingManagement } from "@/frontend/features/recruiter-workspace/job-posting-management";
import {
  createEmptyJobPosting,
  type RecruiterCompanyView,
  type RecruiterJob,
  type RecruiterJobManagementData,
} from "@/shared/contracts/recruiter-job-posting";
import {
  parseRecruiterJobPostingTab,
  recruiterRoutes,
} from "@/shared/routing/recruiter-routes";

const company: RecruiterCompanyView = {
  id: "company-1",
  slug: "northstar-labs",
  name: "Northstar Labs",
  logo: null,
  size: "51-200 employees",
  industry: "Information Technology (IT)",
  address: "Ho Chi Minh City",
  website: null,
  description: "A product company.",
  ownerUserId: "recruiter-1",
};

const draftJob: RecruiterJob = {
  ...createEmptyJobPosting(company.id),
  id: "draft-job",
  title: "Draft Product Designer",
  status: "draft",
  company,
};

const initialData: RecruiterJobManagementData = {
  companyId: company.id,
  recruiterUserId: "recruiter-1",
  companies: [company],
  jobs: [draftJob],
};

describe("recruiter job posting tab navigation", () => {
  it("restores the Drafts tab from routed navigation state", () => {
    const onNavigate = vi.fn();
    const onTabChange = vi.fn();
    const view = render(
      <RecruiterJobPostingManagement
        initialData={initialData}
        initialTab="active"
        onNavigate={onNavigate}
        onTabChange={onTabChange}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Drafts1/ }));
    expect(onTabChange).toHaveBeenCalledWith("draft");
    expect(recruiterRoutes.jobPostingsForTab("draft")).toBe(
      "/recruiter/job-postings?tab=draft",
    );

    view.rerender(
      <RecruiterJobPostingManagement
        initialData={initialData}
        initialTab={parseRecruiterJobPostingTab("draft")}
        onNavigate={onNavigate}
        onTabChange={onTabChange}
      />,
    );

    expect(screen.getByRole("tab", { name: /Drafts1/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("heading", {
        name: "Draft Product Designer",
        level: 2,
      }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Edit job posting/ }));
    expect(onNavigate).toHaveBeenCalledWith(
      "/recruiter/job-postings/draft-job/edit",
    );
  });
});
