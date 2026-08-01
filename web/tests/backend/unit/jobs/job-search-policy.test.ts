import { describe, expect, it } from "vitest";
import { parseJobSearchCriteria } from "@/backend/services/jobs/job-discovery-service";

describe("job search policy", () => {
  it("normalizes Vietnamese criteria and deduplicates arrays", () => {
    const result = parseJobSearchCriteria({
      q: "LẬP  TRÌNH VIÊN",
      location: "Đà Nẵng",
      employmentType: ["FULL_TIME"],
      experienceLevel: [],
      workArrangement: [],
      skills: ["TypeScript"],
      limit: "20",
    });
    expect(result).toMatchObject({
      normalizedQuery: "lap trinh vien",
      normalizedLocation: "da nang",
      normalizedSkills: ["typescript"],
      limit: 20,
    });
  });

  it("uses a deterministic default sort and safe bounds", () => {
    expect(parseJobSearchCriteria({}).sort).toBe("RELEVANCE");
    expect(() => parseJobSearchCriteria({ limit: "1000" })).toThrow();
    expect(() =>
      parseJobSearchCriteria({ salaryMin: "20", salaryMax: "10" }),
    ).toThrow();
  });
});
