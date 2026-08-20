import { describe, expect, it } from "vitest";
import {
  calculateConversionRate,
  calculateFunnel,
} from "@/backend/analytics/analytics-calculations";

describe("recruitment analytics calculations", () => {
  it("calculates view-to-application conversion as a percentage", () => {
    expect(calculateConversionRate(20, 200)).toMatchObject({
      numerator: 20,
      denominator: 200,
      value: 10,
      availability: "AVAILABLE",
    });
  });

  it("returns all canonical funnel stages with percentages", () => {
    const funnel = calculateFunnel({
      APPLIED: 40,
      VIEWED: 30,
      SHORTLISTED: 20,
      INTERVIEWING: 5,
      OFFERED: 3,
      HIRED: 2,
      OFFER_DECLINED: 1,
      REJECTED: 4,
      WAITLISTED: 5,
    });
    expect(funnel).toHaveLength(9);
    expect(funnel.find((item) => item.stage === "HIRED")).toEqual({
      stage: "HIRED",
      count: 2,
      percentage: 1.82,
    });
    expect(funnel.reduce((sum, item) => sum + item.count, 0)).toBe(110);
  });
});
