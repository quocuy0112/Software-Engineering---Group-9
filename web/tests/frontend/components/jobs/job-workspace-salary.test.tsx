import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppliedJobsPage } from "@/frontend/features/jobs/components/applied-jobs-page";
import { JobCardView } from "@/frontend/features/jobs/components/job-card";
import { SavedJobsPage } from "@/frontend/features/jobs/components/saved-jobs-page";
import { SuggestedJobsPage } from "@/frontend/features/jobs/components/suggested-jobs-page";

const job = {
  id: "job-salary",
  slug: "senior-product-manager",
  title: "Senior Product Manager",
  company: {
    slug: "smart-hire",
    displayName: "SmartHire",
    logoUrl: null,
    websiteUrl: null,
    publicDescription: null,
    publicLocation: "Ho Chi Minh City",
  },
  location: "Ho Chi Minh City",
  employmentType: "FULL_TIME" as const,
  experienceLevel: "SENIOR" as const,
  workArrangement: "HYBRID" as const,
  salary: {
    minimum: 35.5,
    maximum: 63.5,
    currency: "VND",
    period: "MONTH" as const,
    isNegotiable: true,
  },
  summary: "Lead product strategy.",
  skills: ["Product management"],
  publishedAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
  applicationDeadline: null,
  actions: {
    authenticated: false,
    saved: true,
    applied: false,
    canSave: false,
    canReport: false,
    canApply: true,
  },
};

const expectedSalary = "35.5 - 63.5 million/month";

describe("workspace job-card salary display", () => {
  it.each([
    ["the main listing card", () => <JobCardView job={job} />],
    ["Saved Jobs", () => <SavedJobsPage jobs={[job]} />],
    [
      "Applied Jobs",
      () => (
        <AppliedJobsPage
          applications={[
            {
              application: {
                jobId: job.id,
                appliedAt: "2026-08-03T00:00:00.000Z",
                status: "submitted",
                contactSnapshot: {
                  fullName: "Job Candidate",
                  email: "candidate@example.test",
                  phone: "0912345678",
                },
                aiAnalysisConsent: true,
              },
              job,
            },
          ]}
        />
      ),
    ],
    [
      "Suggested Jobs",
      () => (
        <SuggestedJobsPage
          jobs={[{ ...job, matchedCriteria: ["Salary"] }]}
          preferencesConfigured
        />
      ),
    ],
  ])("uses the shared salary formatter in %s", (_label, view) => {
    render(view());
    expect(screen.getByText(expectedSalary)).toBeVisible();
  });
});
