import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ApplyButton,
  JobCardView,
} from "@/frontend/features/jobs/components/job-card";
import { JobSearchForm } from "@/frontend/features/jobs/components/job-search-form";
import { CompanyAvatar } from "@/frontend/features/jobs/components/company-avatar";
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
  it("uses a stable company monogram instead of a broken remote logo", () => {
    render(
      <CompanyAvatar
        name="Compass Capital"
        imageUrl="https://example.com/compass-capital/logo.png"
      />,
    );

    expect(screen.getByText("CC")).toBeVisible();
    expect(document.querySelector("img")).toBeNull();
  });

  it("falls back to the company monogram when a local logo fails", () => {
    render(
      <CompanyAvatar name="Smart Hire" imageUrl="/logos/smart-hire.png" />,
    );

    const logo = document.querySelector("img");
    expect(logo).not.toBeNull();
    fireEvent.error(logo!);
    expect(screen.getByText("SH")).toBeVisible();
    expect(document.querySelector("img")).toBeNull();
  });

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

  it("keeps secondary actions visible and preserves action order", () => {
    render(<JobCardView job={job} variant="grid" />);

    for (const name of ["Quick view", "Hide job"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("duration-150");
      expect(screen.getByRole("button", { name })).not.toHaveClass(
        "opacity-0",
        "group-hover:opacity-100",
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
    expect(screen.getByText("Refine search")).toBeVisible();
    expect(screen.getByLabelText(/keywords/i)).toHaveValue("TypeScript");
    expect(screen.getByLabelText(/maximum salary/i)).toBeVisible();
    expect(screen.getByRole("option", { name: "3 days" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: "Đà Nẵng" },
    });
    expect(
      screen.queryByRole("button", { name: /search jobs/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /clear filters/i }).at(-1),
    ).toHaveAttribute("href", "/jobs");
  });

  it("reports text and discrete filter changes with the right trigger", () => {
    const onCriteriaChange = vi.fn();
    render(<JobSearchForm criteria={{}} onCriteriaChange={onCriteriaChange} />);

    fireEvent.change(screen.getByLabelText(/keywords/i), {
      target: { value: "TypeScript" },
    });
    expect(onCriteriaChange).toHaveBeenLastCalledWith(
      { q: "TypeScript" },
      "debounced",
    );

    fireEvent.change(screen.getByLabelText(/employment type/i), {
      target: { value: "FULL_TIME" },
    });
    expect(onCriteriaChange).toHaveBeenLastCalledWith(
      { employmentType: "FULL_TIME" },
      "immediate",
    );
  });

  it("shows removable active filters and opens the mobile drawer accessibly", () => {
    render(
      <JobSearchForm
        criteria={{ q: "TypeScript", location: "Da Nang", sort: "NEWEST" }}
      />,
    );
    expect(
      screen.getByRole("link", { name: /remove filter keyword: typescript/i }),
    ).toHaveAttribute("href", "/jobs?location=Da+Nang&sort=NEWEST");

    const trigger = screen.getByRole("button", { name: /filters3/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Filters" }),
    ).not.toBeInTheDocument();
  });

  it("presents the loading state with the informational blue tone", () => {
    render(<JobsLoading />);
    expect(screen.getByRole("status", { name: "" })).toHaveClass(
      "job-feedback-info",
    );
  });
});
