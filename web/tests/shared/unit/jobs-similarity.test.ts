import { describe, expect, it } from "vitest";
import {
  computeDiscoveryJobs,
  computeMatchScore,
  computeRelatedJobs,
} from "@/shared/utils/jobs/similarity";

const current = {
  id: "job-current",
  status: "open" as const,
  categoryIds: ["construction"],
  categoryFamily: "r1080",
  skillTags: ["Project Management", "AutoCAD"],
  city: "Ho Chi Minh City",
  salaryMin: 18_000_000,
  salaryMax: 25_000_000,
  experienceMinYears: 5,
  industry: "Construction",
  companyId: "company-current",
  title: "Project Manager",
};

describe("job similarity", () => {
  it("combines the requested signals into a 0-100 score", () => {
    expect(computeMatchScore(current, { ...current, id: "job-match" })).toBe(
      100,
    );
    expect(
      computeMatchScore(current, {
        id: "job-family",
        categoryFamily: "r1080",
        skillTags: [],
        city: "Da Nang",
        salaryMin: null,
        salaryMax: null,
        experienceMinYears: null,
      }),
    ).toBe(30);
  });

  it("uses the same weighted engine for candidate-profile matches", () => {
    expect(
      computeMatchScore(
        {
          skillTags: ["Project Management", "AutoCAD"],
          city: "Ho Chi Minh City",
          experienceMinYears: 5,
        },
        current,
      ),
    ).toBe(50);
  });

  it("keeps only open jobs, excludes the current job, and limits results", () => {
    const related = computeRelatedJobs(
      current,
      [
        { ...current },
        { ...current, id: "job-top", postedAt: "2026-08-04T00:00:00.000Z" },
        { ...current, id: "job-older", postedAt: "2026-07-01T00:00:00.000Z" },
        { ...current, id: "job-closed", status: "closed" as const },
      ],
      2,
    );

    expect(related.map((job) => job.id)).toEqual(["job-top", "job-older"]);
    expect(related.every((job) => job.matchScore === 100)).toBe(true);
  });

  it("keeps discovery recommendations broad and excludes direct matches", () => {
    const discovery = computeDiscoveryJobs(
      current,
      [
        {
          ...current,
          id: "job-direct-match",
          companyId: "company-direct",
          postedAt: "2026-08-05T00:00:00.000Z",
        },
        {
          id: "job-discovery",
          status: "open" as const,
          categoryFamily: "r1080",
          industry: "Construction",
          companyId: "company-discovery",
          title: "Operations Manager",
          skillTags: ["People leadership"],
          city: "Da Nang",
          salaryMin: 16_000_000,
          salaryMax: 23_000_000,
          experienceMinYears: 4,
          postedAt: "2026-08-03T00:00:00.000Z",
        },
        {
          id: "job-closed-discovery",
          status: "closed" as const,
          industry: "Construction",
          companyId: "company-closed",
          title: "Site Manager",
        },
      ],
      new Set(["job-direct-match"]),
      5,
    );

    expect(discovery.map((job) => job.id)).toContain("job-discovery");
    expect(discovery.map((job) => job.id)).not.toContain("job-direct-match");
    expect(discovery.map((job) => job.id)).not.toContain(
      "job-closed-discovery",
    );
    expect(discovery).toHaveLength(1);
  });
});
