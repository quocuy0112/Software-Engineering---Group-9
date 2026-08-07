import { describe, expect, it } from "vitest";
import {
  formatSalary,
  isSalaryNegotiable,
} from "@/shared/utils/jobs/job-display";

describe("formatSalary", () => {
  it.each([
    [
      "a complete range even when marked negotiable",
      {
        minimum: 35.5,
        maximum: 63.5,
        period: "MONTH",
        isNegotiable: true,
      },
      "35.5 - 63.5 million/month",
    ],
    [
      "a minimum-only salary",
      { minimum: 35.5, maximum: null, period: "MONTH" },
      "From 35.5 million/month",
    ],
    [
      "a maximum-only salary",
      { minimum: null, maximum: 63.5, period: "MONTH" },
      "Up to 63.5 million/month",
    ],
  ])("formats %s", (_label, salary, expected) => {
    expect(formatSalary(salary)).toBe(expected);
  });

  it.each([null, undefined, {}, { minimum: null, maximum: null }])(
    "uses Negotiable when no salary amount is provided (%s)",
    (salary) => {
      expect(formatSalary(salary)).toBe("Negotiable");
    },
  );

  it("keeps the negotiable style only for the fallback display", () => {
    expect(
      isSalaryNegotiable({
        minimum: 35.5,
        maximum: 63.5,
        period: "MONTH",
        isNegotiable: true,
      }),
    ).toBe(false);
    expect(isSalaryNegotiable(null)).toBe(true);
  });
});
