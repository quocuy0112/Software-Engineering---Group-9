import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecruiterJob } from "@/shared/contracts/recruiter-job-posting";
import { RecruiterCandidatesPage } from "@/frontend/features/recruiter-applications/recruiter-candidates-page";

vi.mock("@/frontend/features/recruiter-applications/use-campaign-scoring-stats", () => ({
  useCampaignScoringStats: () => ({
    stats: {},
    error: null,
    loading: false,
  }),
}));

function makeJobs(count: number): RecruiterJob[] {
  return Array.from({ length: count }, (_, index) =>
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
});

describe("recruiter campaign pagination", () => {
  it("pages the campaign grid and resets to page one when filters change", () => {
    render(<RecruiterCandidatesPage jobs={makeJobs(25)} />);

    expect(screen.getAllByText("Showing 1–12 of 25 campaigns")).toHaveLength(2);
    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    expect(screen.getByText("Campaign 1")).toBeInTheDocument();
    expect(screen.queryByText("Campaign 13")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(screen.getAllByText("Showing 13–24 of 25 campaigns")).toHaveLength(2);
    expect(screen.getByText("Campaign 13")).toBeInTheDocument();
    expect(screen.queryByText("Campaign 1")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search by role, company, or department"), {
      target: { value: "Campaign 25" },
    });
    expect(screen.getAllByText("Showing 1–1 of 1 campaigns")).toHaveLength(2);
    expect(screen.getByText("Campaign 25")).toBeInTheDocument();
  });
});
