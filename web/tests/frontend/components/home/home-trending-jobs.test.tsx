import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeTrendingJobs } from "@/frontend/features/home/components/home-trending-jobs";
import {
  candidateViewer,
  homeJob,
  homeModel,
  personalMatch,
} from "../../../helpers/home/home-fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("Trending Opportunities", () => {
  it("caps public cards and renders required detail destinations", () => {
    const jobs = Array.from({ length: 8 }, (_, index) =>
      homeJob({ id: `job-${index}`, slug: `job-${index}`, title: `Job ${index}` }),
    );
    render(<HomeTrendingJobs model={{ ...homeModel(), jobs: { status: "ready", items: jobs } }} locale="en" />);
    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(screen.getByRole("link", { name: "Job 0" })).toHaveAttribute("href", "/jobs/job-0");
    expect(screen.getAllByText("Hà Nội · Hybrid · Internship").length).toBeGreaterThan(0);
  });

  it("shows a compact estimate only for the exact personal recommendation", () => {
    const jobs = [
      homeJob({ matchScore: 75 }),
      homeJob({ id: "job-2", slug: "backend-intern", title: "Backend Intern", matchScore: undefined }),
    ];
    render(
      <HomeTrendingJobs
        model={homeModel({ viewer: candidateViewer, match: personalMatch(), jobs })}
        locale="en"
      />,
    );
    const estimate = screen.getByText("75% match estimate");
    expect(estimate).toHaveAttribute("aria-describedby", "smart-match-explanation-frontend-intern");
    expect(screen.getAllByText(/match estimate/u)).toHaveLength(1);
  });

  it("never renders illustrative or employer card scores", () => {
    render(<HomeTrendingJobs model={homeModel({ jobs: [homeJob({ matchScore: 82 })] })} locale="en" />);
    expect(screen.queryByText(/82% match estimate/u)).not.toBeInTheDocument();
  });
});
