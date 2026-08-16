import { describe, expect, it } from "vitest";
import { inspectCvForAiPreflight } from "@/backend/scoring/domain/cv-preflight";

describe("CV AI preflight", () => {
  it("flags redaction placeholders in date fields", () => {
    const issues = inspectCvForAiPreflight({
      cvText: '"startDate":"[phone redacted]", "endDate":"Present"',
      jobTitle: "IT Comtor",
    });
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ bucket: "input_limitation", description: expect.stringContaining("Employment date") }),
    ]));
  });

  it("flags an implausible extracted year instead of treating it as experience", () => {
    const issues = inspectCvForAiPreflight({ cvText: "Employment: 0634-06-01 to Present" });
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ bucket: "extraction_uncertainty" }),
    ]));
  });

  it("flags unrelated skill domains once for manual review", () => {
    const issues = inspectCvForAiPreflight({
      cvText: "Digital Marketing, SEO, Adobe Photoshop. React Native, TypeScript, REST API.",
      jobTitle: "IT Comtor",
      requiredSkills: ["Customer Focus"],
    });
    expect(issues.filter((issue) => issue.description.includes("unrelated skill domains"))).toHaveLength(1);
  });

  it("does not flag an ordinary IT CV", () => {
    expect(inspectCvForAiPreflight({
      cvText: "React and TypeScript developer with 2 years of experience.",
      jobTitle: "Frontend Engineer",
    })).toEqual([]);
  });
});
