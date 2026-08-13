import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomePageView } from "@/frontend/features/home/components/home-page-view";
import {
  candidateViewer,
  employerViewer,
  homeModel,
  personalMatch,
} from "../../../helpers/home/home-fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const orderedHeadings = [
  "What's New Today?",
  "Smart Match",
  "Career Paths",
  "Employer Spotlight",
  "Trending Opportunities",
  "Career Growth Hub",
  "Career Events",
];

describe("HomePageView shared shell", () => {
  it.each([
    ["guest", homeModel()],
    ["candidate", homeModel({ viewer: candidateViewer, match: personalMatch() })],
    ["employer", homeModel({ viewer: employerViewer })],
    ["expired session", homeModel({ viewer: { kind: "guest" } })],
  ])("keeps the same ordered Home sections for %s", (_name, model) => {
    const { container } = render(<HomePageView model={model} />);
    const headings = [...container.querySelectorAll("h2")].map((node) =>
      node.textContent?.trim(),
    );
    let cursor = -1;
    for (const heading of orderedHeadings) {
      const next = headings.indexOf(heading, cursor + 1);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Find the right job. Meet the right team. Grow in the right direction.",
    );
  });

  it("keeps private account slots conditional without duplicating the page", () => {
    const { rerender } = render(<HomePageView model={homeModel()} />);
    expect(screen.getAllByRole("link", { name: "Log in" }).length).toBeGreaterThan(0);
    expect(screen.queryByText("My Applications")).not.toBeInTheDocument();

    rerender(
      <HomePageView
        model={homeModel({ viewer: candidateViewer, match: personalMatch() })}
      />,
    );
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
    expect(screen.getAllByText("My Applications").length).toBeGreaterThan(0);
  });
});
