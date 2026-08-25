import { describe, expect, it } from "vitest";
import {
  createEmptyJobPosting,
  formatRecruiterSalary,
  formatVndInput,
  parseVndInput,
  prepareRecruiterJobForSave,
  validateRecruiterJobForSave,
} from "@/shared/contracts/recruiter-job-posting";
import {
  collectRecruiterSubIndustrySuggestions,
  deriveRecruiterClassification,
} from "@/shared/contracts/jobs/industry-taxonomy";

describe("recruiter job posting editor contract", () => {
  it("reports friendly errors for required posting fields", () => {
    const job = createEmptyJobPosting("company-1");
    job.subIndustry = "";

    expect(validateRecruiterJobForSave(job, "pending_approval")).toEqual(
      expect.objectContaining({
        title: "Enter a job title.",
        shortPitch: "Add a short pitch.",
        subIndustry: "Enter a sub-industry.",
        "description.overview": "Add a role overview.",
        applyDeadline: "Choose an application deadline.",
      }),
    );
  });

  it("normalizes user-entered text and accepts a complete posting", () => {
    const job = createEmptyJobPosting("company-1");
    job.title = "  Product Designer  ";
    job.shortPitch = "  Build thoughtful hiring experiences.  ";
    job.subIndustry = "  HR Technology  ";
    job.skillTags = [" Figma ", "Figma", " Research "];
    job.description.overview = "  Own end-to-end product design.  ";
    job.applyDeadline = "2099-12-31T23:59:59.000Z";

    const prepared = prepareRecruiterJobForSave(job);

    expect(prepared.title).toBe("Product Designer");
    expect(prepared.subIndustry).toBe("HR Technology");
    expect(prepared.categoryIds).toEqual(["r03-other"]);
    expect(prepared.categoryFamily).toBe("r03");
    expect(prepared.description.generalInfo.department).toBe("HR Technology");
    expect(prepared.skillTags).toEqual(["Figma", "Research"]);
    expect(validateRecruiterJobForSave(prepared, "pending_approval")).toEqual(
      {},
    );
  });

  it("keeps canonical ids for listed sub-industries and stable fallback ids for custom values", () => {
    expect(
      deriveRecruiterClassification({
        industryCode: "r03",
        subIndustry: "Software Development",
      }),
    ).toMatchObject({
      industryCode: "r03",
      categoryIds: ["r03-software-development"],
      valid: true,
    });
    expect(
      deriveRecruiterClassification({
        industryCode: "other",
        subIndustry: "Aerospace Operations",
      }),
    ).toMatchObject({
      industryCode: "other",
      categoryIds: ["other-other"],
      valid: true,
    });
  });

  it("collects existing sub-industries as suggestions without promoting them", () => {
    expect(
      collectRecruiterSubIndustrySuggestions([
        { industryCode: "other", subIndustry: "Aerospace Operations" },
        { industryCode: "r29", subIndustry: " aerospace operations " },
        { industryCode: "r03", subIndustry: "HR Technology" },
      ]),
    ).toEqual({
      other: ["Aerospace Operations"],
      r03: ["HR Technology"],
    });
  });

  it("rejects an invalid salary range", () => {
    const job = createEmptyJobPosting("company-1");
    job.title = "Product Designer";
    job.shortPitch = "Build thoughtful hiring experiences.";
    job.description.overview = "Own end-to-end product design.";
    job.salary = { ...job.salary, min: 50_000_000, max: 20_000_000 };

    expect(validateRecruiterJobForSave(job, "draft")).toEqual(
      expect.objectContaining({
        "salary.max":
          "Maximum salary must be greater than or equal to minimum salary.",
      }),
    );
  });
  it("parses readable and shorthand VND salary input without storing separators", () => {
    expect(parseVndInput("29.000.000")).toBe(29_000_000);
    expect(parseVndInput("29,000,000")).toBe(29_000_000);
    expect(parseVndInput("29tr")).toBe(29_000_000);
    expect(parseVndInput("29,5 triệu")).toBe(29_500_000);
    expect(parseVndInput("")).toBe(0);
    expect(formatVndInput(29_000_000)).toBe("29.000.000");
  });

  it("formats the candidate-facing VND salary range and hides an empty range", () => {
    expect(
      formatRecruiterSalary({
        min: 29_000_000,
        max: 33_000_000,
        currency: "VND",
        period: "month",
        isNegotiable: true,
      }),
    ).toBe("29,000,000 - 33,000,000 VND/month");
    expect(
      formatRecruiterSalary({
        min: 0,
        max: 0,
        currency: "VND",
        period: "month",
        isNegotiable: true,
      }),
    ).toBeNull();
  });
});
