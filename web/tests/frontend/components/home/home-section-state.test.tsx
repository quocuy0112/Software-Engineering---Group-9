import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeSectionStateView } from "@/frontend/features/home/components/home-section-state";
import { HomeAuthRequiredFeedback } from "@/frontend/features/home/components/home-auth-required-feedback";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const labels = {
  loading: "Loading jobs…",
  empty: "No jobs yet.",
  error: "Jobs are temporarily unavailable.",
  reloadHome: "Reload Home",
};

describe("Home section states", () => {
  it("renders localized loading and empty messages", () => {
    const { rerender } = render(<HomeSectionStateView state={{ status: "loading", items: [] }} labels={labels} />);
    expect(screen.getByText("Loading jobs…")).toHaveAttribute("aria-busy", "true");
    rerender(<HomeSectionStateView state={{ status: "empty", items: [] }} labels={labels} />);
    expect(screen.getByText("No jobs yet.")).toBeInTheDocument();
  });

  it("calls the safe full refresh only from an explicitly labelled Reload Home action", () => {
    render(<HomeSectionStateView state={{ status: "error", items: [], recovery: { kind: "reloadHome" } }} labels={labels} />);
    expect(screen.queryByRole("button", { name: /Retry section/iu })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reload Home" }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("uses an allowlisted account-required destination", () => {
    render(<HomeAuthRequiredFeedback returnTo="/jobs/frontend-intern" label="Log in to save this job" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/login?returnTo=%2Fjobs%2Ffrontend-intern");
  });
});
