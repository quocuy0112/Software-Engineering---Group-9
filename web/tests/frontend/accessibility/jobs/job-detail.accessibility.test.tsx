import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobDetailView } from "@/frontend/features/jobs/components/job-detail";
import type { JobDetail } from "@/shared/contracts/jobs/discovery";

const job = {
  id: "job-1",
  slug: "job",
  title: "Accessible Engineer",
  company: {
    slug: "company",
    displayName: "Company",
    logoUrl: null,
    websiteUrl: null,
    publicDescription: null,
    publicLocation: null,
  },
  location: "Remote",
  employmentType: "FULL_TIME",
  experienceLevel: "MID",
  workArrangement: "REMOTE",
  salary: null,
  summary: "Summary",
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
  state: "ACTIVE",
  description: "Description",
  responsibilities: "Responsibilities",
  requirements: "Requirements",
  benefits: null,
  canonicalUrl: "https://jobs.example.test/jobs/job",
} satisfies JobDetail;

describe("job detail accessibility", () => {
  it("uses one main title, labeled state, and semantic sections", () => {
    render(<JobDetailView job={job} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      job.title,
    );
    expect(screen.getByText("Active")).toHaveAccessibleName(
      /job status: active/i,
    );
    expect(
      screen.getByRole("heading", { name: /requirements/i }),
    ).toBeVisible();
  });
});
