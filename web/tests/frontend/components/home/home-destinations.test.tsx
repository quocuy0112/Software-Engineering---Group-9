import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomePageView } from "@/frontend/features/home/components/home-page-view";
import { candidateViewer, employerViewer, homeModel } from "../../../helpers/home/home-fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

describe("Home destination map", () => {
  it("uses only existing public routes and matching in-page anchors", () => {
    const { container } = render(<HomePageView model={homeModel()} />);
    for (const id of ["community", "employer-spotlight", "events", "jobs"])
      expect(container.querySelector(`#${id}`)).toBeInTheDocument();
    const hrefs = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    for (const destination of [
      "/jobs",
      "#community",
      "#employer-spotlight",
      "#events",
      "/jobs/frontend-intern",
      "/register",
      "/login?returnTo=%2Fdashboard%2Femployer-verification",
    ]) expect(hrefs).toContain(destination);
    expect(hrefs).not.toContain("/companies");
    for (const selector of [".home-feed-grid", ".home-path-grid", ".home-spotlight-grid", ".home-growth-grid", ".home-events-grid"])
      expect(within(container.querySelector(selector) as HTMLElement).queryByRole("link")).not.toBeInTheDocument();
  });

  it("maps candidate shortcuts/profile and preserves recruiter authority separately", () => {
    const { rerender } = render(<HomePageView model={homeModel({ viewer: candidateViewer })} />);
    for (const [name, href] of [
      ["My Dashboard", "/dashboard"],
      ["My Applications", "/jobs/applied"],
      ["Saved Jobs", "/jobs/saved"],
      ["Create Profile", "/profile"],
    ]) expect(screen.getAllByRole("link", { name })[0]).toHaveAttribute("href", href);
    rerender(<HomePageView model={homeModel({ viewer: employerViewer })} />);
    expect(screen.getAllByRole("link", { name: "Post a Job" })[0]).toHaveAttribute("href", "https://recruiter.example.test");
  });
});
