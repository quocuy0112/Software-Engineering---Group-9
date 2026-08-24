import { describe, expect, it } from "vitest";
import { filterWorkspaceJobs } from "@/backend/services/jobs/job-workspace-search";
import type { JobCard } from "@/shared/contracts/jobs/discovery";

const job = (overrides: Partial<JobCard>): JobCard => ({
  id: "job-1",
  slug: "job-1",
  title: "Product Designer",
  company: {
    slug: "compass-capital",
    displayName: "Compass Capital",
    logoUrl: null,
    websiteUrl: null,
    publicDescription: null,
    publicLocation: null,
  },
  location: "Vung Tau City Center, Bà Rịa - Vũng Tàu",
  employmentType: "FULL_TIME",
  experienceLevel: "MID",
  workArrangement: "HYBRID",
  salary: null,
  summary: "Design useful products.",
  skills: ["Figma", "Research"],
  publishedAt: "2026-08-01T00:00:00.000Z",
  applicationDeadline: null,
  actions: {
    authenticated: true,
    saved: true,
    applied: false,
    canSave: true,
    canReport: true,
    canApply: true,
  },
  ...overrides,
});

describe("workspace job-list search", () => {
  it("filters only the supplied list by query, city, and selected district", () => {
    const otherDistrict = job({
      id: "job-2",
      slug: "job-2",
      title: "Sales Executive",
      location: "Long Điền, Bà Rịa - Vũng Tàu",
      skills: ["Sales"],
    });

    expect(
      filterWorkspaceJobs([job({}), otherDistrict], {
        q: "Compass",
        location: "Bà Rịa - Vũng Tàu",
        district: ["Vung Tau City Center"],
      }).map((item) => item.id),
    ).toEqual(["job-1"]);
  });
});
