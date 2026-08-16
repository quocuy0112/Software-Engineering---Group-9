import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RecruiterJob } from "@/shared/contracts/recruiter-job-posting";
import { RecruiterCandidatesPage } from "@/frontend/features/recruiter-applications/recruiter-candidates-page";

const refreshMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@/frontend/features/recruiter-applications/use-campaign-scoring-stats",
  () => ({
    useCampaignScoringStats: (jobs: RecruiterJob[]) => ({
      jobs,
      stats: {},
      error: null,
      campaignError: null,
      loading: false,
      refreshing: false,
      lastUpdatedAt: new Date("2026-08-16T00:00:00.000Z"),
      changedJobIds: new Set<string>(),
      clearChangedJob: vi.fn(),
      refresh: refreshMock,
    }),
  }),
);

const job = {
  id: "job-1",
  title: "Product Designer",
  status: "active",
  updatedAt: "2026-08-15T00:00:00.000Z",
  stats: { applicantCount: 12 },
  company: { name: "Northstar Labs" },
  categoryFamily: "Design",
  industry: "Technology",
  description: { generalInfo: { department: "Design" } },
} as unknown as RecruiterJob;

describe("recruiter campaign refresh controls", () => {
  it("exposes a manual refresh action and completion confirmation", () => {
    render(<RecruiterCandidatesPage jobs={[job]} />);

    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.getByText("Updated just now")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(refreshMock).toHaveBeenCalledWith("manual");
  });
});
