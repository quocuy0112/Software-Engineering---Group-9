import { describe, expect, it } from "vitest";
import {
  formatRelativeTime,
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

  it("formats salary in Vietnamese", () => {
    expect(
      formatSalary({ minimum: 35.5, maximum: 63.5, period: "MONTH" }, "vi"),
    ).toBe("35,5 - 63,5 triệu/tháng");
    expect(formatSalary({ minimum: null, maximum: null }, "vi")).toBe(
      "Thỏa thuận",
    );
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-27T00:00:00.000Z");

  it("formats relative time in the selected locale", () => {
    const publishedAt = new Date("2026-08-06T00:00:00.000Z");

    expect(formatRelativeTime(publishedAt, "vi", now)).toBe("3 tuần trước");
    expect(formatRelativeTime(publishedAt, "en", now)).toBe("3 weeks ago");
  });

  it("keeps the legacy Date argument compatible", () => {
    const publishedAt = new Date("2026-08-06T00:00:00.000Z");

    expect(formatRelativeTime(publishedAt, now)).toBe("3 weeks ago");
  });

  it("uses a localized fallback for invalid dates", () => {
    expect(formatRelativeTime("not-a-date", "vi", now)).toBe("gần đây");
  });
});
