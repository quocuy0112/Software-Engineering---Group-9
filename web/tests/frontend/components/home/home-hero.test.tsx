import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomePageView } from "@/frontend/features/home/components/home-page-view";
import { homeModel, candidateViewer, employerViewer } from "../../../helpers/home/home-fixtures";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

describe("Home Hero", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the approved proposition, six filters, and guest CTAs", () => {
    render(<HomePageView model={homeModel()} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Find the right job. Meet the right team. Grow in the right direction.",
    );
    for (const label of [
      "Keyword",
      "Location",
      "Work arrangement",
      "Employment type",
      "Experience level",
      "Skills",
    ]) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Create Profile" })[0]).toHaveAttribute("href", "/register");
    expect(screen.getAllByRole("link", { name: "Post a Job" })[0]).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fdashboard%2Femployer-verification",
    );
  });

  it("submits only the approved discovery parameters", () => {
    render(<HomePageView model={homeModel()} />);
    fireEvent.change(screen.getByLabelText("Keyword"), { target: { value: "frontend" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Hà Nội" } });
    fireEvent.change(screen.getByLabelText("Work arrangement"), { target: { value: "HYBRID" } });
    fireEvent.change(screen.getByLabelText("Skills"), { target: { value: "React, React, CSS" } });
    fireEvent.click(screen.getByRole("button", { name: "Search jobs" }));
    expect(navigation.push).toHaveBeenCalledOnce();
    const destination = navigation.push.mock.calls[0][0] as string;
    expect(destination).toContain("/jobs?");
    expect(destination).toContain("q=frontend");
    expect(destination).toContain("workArrangement=HYBRID");
    expect(destination.match(/skills=/gu)).toHaveLength(2);
    expect(destination).not.toMatch(/(?:session|role|score|mock|locale)=/u);
  });

  it("uses the profile route after login and only resolved recruiter destinations", () => {
    const { rerender } = render(<HomePageView model={homeModel({ viewer: candidateViewer })} />);
    expect(screen.getAllByRole("link", { name: "Create Profile" })[0]).toHaveAttribute("href", "/profile");
    expect(screen.getAllByText(/Status unavailable/u).length).toBeGreaterThan(0);

    rerender(<HomePageView model={homeModel({ viewer: employerViewer })} />);
    expect(screen.getAllByRole("link", { name: "Post a Job" })[0]).toHaveAttribute(
      "href",
      "https://recruiter.example.test",
    );
  });
});
