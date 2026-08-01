import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobCardView } from "@/frontend/features/jobs/components/job-card";
import { JobSearchForm } from "@/frontend/features/jobs/components/job-search-form";

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
    expect(screen.getByText("Hồ Chí Minh")).toBeVisible();
  });

  it("exposes labeled filters and a clear action", () => {
    render(<JobSearchForm criteria={{ q: "TypeScript" }} />);
    expect(screen.getByLabelText(/keywords/i)).toHaveValue("TypeScript");
    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: "Đà Nẵng" },
    });
    expect(screen.getByRole("button", { name: /search jobs/i })).toBeEnabled();
    expect(screen.getByRole("link", { name: /clear all/i })).toHaveAttribute(
      "href",
      "/jobs",
    );
  });
});
