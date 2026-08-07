import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ApplyButton,
  JobCardView,
} from "@/frontend/features/jobs/components/job-card";
import { JobSearchForm } from "@/frontend/features/jobs/components/job-search-form";
import JobsLoading from "@/app/jobs/loading";

const job = {
  id: "job-1",
  slug: "lap-trinh-vien",
  title: "Lập trình viên TypeScript",
  company: {
    slug: "smart-hire",
    displayName: "SmartHire",
    logoUrl: null,
    websiteUrl: null,
    publicDescription: null,
    publicLocation: "Hồ Chí Minh",
  },
  location: "Hồ Chí Minh",
  employmentType: "FULL_TIME" as const,
  experienceLevel: "MID" as const,
  workArrangement: "HYBRID" as const,
  salary: null,
  summary: "Build accessible products.",
  skills: ["TypeScript"],
  publishedAt: "2026-08-01T00:00:00.000Z",
  applicationDeadline: null,
  actions: {
    authenticated: false,
    saved: false,
    applied: false,
    canSave: false,
    canReport: false,
    canApply: true,
  },
};

describe("job discovery presentation", () => {
  it("renders a semantic result with its stable detail link", () => {
    render(<JobCardView job={job} />);
    expect(
      screen.getByRole("link", { name: /lập trình viên typescript/i }),
    ).toHaveAttribute("href", "/jobs/lap-trinh-vien");
    expect(screen.getByText("Negotiable")).toHaveClass(
      "job-salary--negotiable",
    );
    expect(screen.getByText("Hồ Chí Minh")).toBeVisible();
  });

  it("routes authenticated card Apply clicks to the detail-page modal", () => {
    render(
      <ApplyButton
        job={{
          ...job,
          actions: { ...job.actions, authenticated: true },
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "Apply" })).toHaveAttribute(
      "href",
      "/jobs/lap-trinh-vien?apply=true",
    );
  });

  it("keeps secondary actions hover-only and preserves action order", () => {
    render(<JobCardView job={job} variant="grid" />);

    for (const name of ["Quick view", "Hide job"]) {
      expect(screen.getByRole("button", { name })).toHaveClass(
        "opacity-0",
        "group-hover:opacity-100",
        "duration-150",
      );
    }

    const actions = document.querySelector(".job-card-grid-actions");
    expect(actions).not.toBeNull();
    const orderedActions = Array.from(
      actions?.querySelectorAll("button, a") ?? [],
    ).map(
      (element) =>
        element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
    );
    expect(orderedActions).toEqual([
      "Quick view",
      "Hide job",
      "Sign in to save this job",
      "Apply",
    ]);
  });

  it("exposes labeled filters and a clear action", () => {
    render(<JobSearchForm criteria={{ q: "TypeScript" }} />);
    expect(screen.getByLabelText(/keywords/i)).toHaveValue("TypeScript");
    expect(screen.getByLabelText(/maximum salary/i)).toBeVisible();
    expect(screen.getByRole("option", { name: "3 days" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: "Đà Nẵng" },
    });
    expect(screen.getByRole("button", { name: /search jobs/i })).toBeEnabled();
    expect(screen.getByRole("link", { name: /clear all/i })).toHaveAttribute(
      "href",
      "/jobs",
    );
  });

  it("presents the loading state with the informational blue tone", () => {
    render(<JobsLoading />);
    expect(screen.getByRole("status", { name: "" })).toHaveClass(
      "job-feedback-info",
    );
  });
});
