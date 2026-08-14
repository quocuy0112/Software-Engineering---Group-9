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

  it("accepts only an approved career-path filter", () => {
    expect(
      parseJobSearchCriteria({ careerPath: "software-engineering" })
        .careerPath,
    ).toBe("software-engineering");
    expect(() => parseJobSearchCriteria({ careerPath: "made-up-path" })).toThrow();
  });

  it("treats empty browser filter controls as omitted criteria", () => {
    const result = parseJobSearchCriteria({
      q: "",
      location: "",
      employmentType: [""],
      experienceLevel: [""],
      workArrangement: [""],
      skills: [""],
      salaryMin: "",
      salaryMax: "",
      postedWithinDays: "",
      cursor: "",
      limit: "",
    });

    expect(result).toMatchObject({
      normalizedQuery: "",
      normalizedLocation: "",
      normalizedSkills: [],
      employmentType: [],
      experienceLevel: [],
      workArrangement: [],
      sort: "RELEVANCE",
      limit: 20,
    });
    expect(result.salaryMin).toBeUndefined();
    expect(result.salaryMax).toBeUndefined();
    expect(result.postedWithinDays).toBeUndefined();
    expect(result.cursor).toBeUndefined();
  });
});
