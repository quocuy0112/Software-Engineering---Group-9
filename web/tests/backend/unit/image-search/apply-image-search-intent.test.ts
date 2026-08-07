import { describe, expect, it } from "vitest";

import { applyImageSearchIntent } from "@/frontend/features/jobs/image-search/client/apply-image-search-intent";
import type { ManualSearchContext } from "@/shared/contracts/jobs/image-search";
import type { SearchIntent } from "@/shared/contracts/jobs/search-intent";

const current: ManualSearchContext = {
  q: "Existing keyword",
  location: "Existing location",
  employmentType: ["CONTRACT"],
  experienceLevel: ["MID"],
  workArrangement: ["ONSITE"],
  skills: ["Legacy skill"],
  salaryMin: 10_000_000,
  salaryMax: 20_000_000,
  salaryCurrency: "VND",
  salaryPeriod: "MONTH",
  postedWithinDays: 30,
  sort: "NEWEST",
};

const evidence = [{ startCodePoint: 0, endCodePoint: 4, text: "text" }];

const intent: SearchIntent = {
  schemaVersion: "job-search-intent-v1",
  language: "EN",
  warnings: [],
  proposals: [
    {
      id: "title",
      field: "q",
      stringValue: "Product Manager",
      numberValue: null,
      stringValues: [],
      confidence: 0.99,
      basis: "EXPLICIT",
      evidence,
      selected: true,
      selectionReason: "AUTO_EXPLICIT",
    },
    {
      id: "ignored-location",
      field: "location",
      stringValue: "Hue",
      numberValue: null,
      stringValues: [],
      confidence: 0.82,
      basis: "INFERRED",
      evidence,
      selected: false,
      selectionReason: "USER_SELECTION_REQUIRED",
    },
    {
      id: "employment",
      field: "employmentType",
      stringValue: null,
      numberValue: null,
      stringValues: ["FULL_TIME"],
      confidence: 0.98,
      basis: "NORMALIZED",
      evidence,
      selected: true,
      selectionReason: "AUTO_NORMALIZED",
    },
    {
      id: "skills-one",
      field: "skills",
      stringValue: null,
      numberValue: null,
      stringValues: ["Agile", "User Research"],
      confidence: 0.98,
      basis: "EXPLICIT",
      evidence,
      selected: true,
      selectionReason: "AUTO_EXPLICIT",
    },
    {
      id: "skills-two",
      field: "skills",
      stringValue: null,
      numberValue: null,
      stringValues: ["Product Management", "Agile"],
      confidence: 0.97,
      basis: "EXPLICIT",
      evidence,
      selected: true,
      selectionReason: "AUTO_EXPLICIT",
    },
    {
      id: "minimum-salary",
      field: "salaryMin",
      stringValue: null,
      numberValue: 16_000_000,
      stringValues: [],
      confidence: 0.96,
      basis: "NORMALIZED",
      evidence,
      selected: true,
      selectionReason: "AUTO_NORMALIZED",
    },
  ],
};

describe("applyImageSearchIntent", () => {
  it("replaces reviewed fields, preserves unchecked fields, and starts a jobs search", () => {
    const result = new URL(
      applyImageSearchIntent(current, intent),
      "http://localhost",
    );

    expect(result.pathname).toBe("/jobs");
    expect(result.searchParams.get("q")).toBe("Product Manager");
    expect(result.searchParams.get("location")).toBe("Existing location");
    expect(result.searchParams.getAll("employmentType")).toEqual(["FULL_TIME"]);
    expect(result.searchParams.getAll("skills")).toEqual([
      "Agile",
      "User Research",
      "Product Management",
    ]);
    expect(result.searchParams.get("salaryMin")).toBe("16000000");
    expect(result.searchParams.get("salaryMax")).toBe("20000000");
    expect(result.searchParams.getAll("workArrangement")).toEqual(["ONSITE"]);
    expect(result.searchParams.get("sort")).toBe("NEWEST");
  });

  it("keeps current filters when no proposal is selected", () => {
    const result = new URL(
      applyImageSearchIntent(current, {
        ...intent,
        proposals: intent.proposals.map((proposal) => ({
          ...proposal,
          selected: false,
          selectionReason: "USER_SELECTION_REQUIRED" as const,
        })),
      }),
      "http://localhost",
    );

    expect(result.searchParams.get("q")).toBe("Existing keyword");
    expect(result.searchParams.getAll("skills")).toEqual(["Legacy skill"]);
    expect(result.searchParams.get("salaryMin")).toBe("10000000");
  });
});
