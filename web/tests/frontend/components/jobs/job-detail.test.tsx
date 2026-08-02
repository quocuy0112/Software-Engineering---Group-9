import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobDetailView } from "@/frontend/features/jobs/components/job-detail";
import type { JobDetail } from "@/shared/contracts/jobs/discovery";

const detail: JobDetail = {
  id: "job-1",
  slug: "lap-trinh-vien",
  title: "Lập trình viên TypeScript",
  company: {
    slug: "smart-hire",
    displayName: "SmartHire",
    logoUrl: null,
    websiteUrl: null,
    publicDescription: "A verified company.",
    publicLocation: "Hồ Chí Minh",
  },
  location: "Hồ Chí Minh",
  employmentType: "FULL_TIME",
  experienceLevel: "MID",
  workArrangement: "HYBRID",
  salary: null,
  summary: "Build accessible products.",
  skills: ["TypeScript"],
  publishedAt: "2026-07-20T00:00:00.000Z",
  applicationDeadline: null,
  actions: {
    authenticated: false,
    saved: false,
    applied: false,
    canSave: false,
    canReport: false,
    canApply: true,
  },
  state: "ACTIVE",
  description: "Detailed description.",
  responsibilities: "Design and implement.",
  requirements: "TypeScript experience.",
  benefits: null,
  canonicalUrl: "https://jobs.example.test/jobs/lap-trinh-vien",
};

describe("job detail presentation", () => {
  it("renders approved sections and a visitor sign-in return path", () => {
    render(<JobDetailView job={detail} />);
    expect(screen.getByRole("heading", { name: detail.title })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /responsibilities/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /sign in to apply/i }),
    ).toHaveAttribute("href", "/login?returnTo=%2Fjobs%2Flap-trinh-vien");
  });

  it("shows a textual closed state and removes apply", () => {
    render(
      <JobDetailView
        job={{
          ...detail,
          state: "CLOSED",
          actions: { ...detail.actions, canApply: false },
        }}
      />,
    );
    expect(screen.getByText("Closed")).toBeVisible();
    expect(screen.queryByRole("link", { name: /apply/i })).toBeNull();
  });
});
