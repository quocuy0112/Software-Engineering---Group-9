import { describe, expect, it } from "vitest";
import {
  buildReportBuckets,
  makeMetricRate,
  normalizeReportRange,
} from "@/backend/analytics/report-time-policy";

describe("recruitment analytics time policy", () => {
  it("builds half-open daily buckets", () => {
    const buckets = buildReportBuckets({
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-01-04T00:00:00.000Z"),
      timeZone: "UTC",
      grouping: "DAY",
    });
    expect(buckets).toHaveLength(3);
    expect(buckets[0]).toEqual({
      start: new Date("2026-01-01T00:00:00.000Z"),
      end: new Date("2026-01-02T00:00:00.000Z"),
    });
  });

  it("uses Monday week boundaries in a non-UTC timezone", () => {
    const buckets = buildReportBuckets({
      from: new Date("2026-01-07T00:00:00.000Z"),
      to: new Date("2026-01-15T00:00:00.000Z"),
      timeZone: "Asia/Ho_Chi_Minh",
      grouping: "WEEK",
    });
    expect(buckets[0]?.start.toISOString()).toBe("2026-01-07T00:00:00.000Z");
    expect(buckets[0]?.end.getTime()).toBeGreaterThan(
      buckets[0]!.start.getTime(),
    );
  });

  it("rejects ranges before the analytics baseline and invalid ranges", () => {
    expect(() =>
      normalizeReportRange({
        from: new Date("2025-12-31T00:00:00.000Z"),
        to: new Date("2026-01-02T00:00:00.000Z"),
        timeZone: "UTC",
        grouping: "DAY",
        analyticsAvailableFrom: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toThrowError(/ANALYTICS_RANGE_UNAVAILABLE/u);
    expect(() =>
      normalizeReportRange({
        from: new Date("2026-01-02T00:00:00.000Z"),
        to: new Date("2026-01-01T00:00:00.000Z"),
        timeZone: "UTC",
        grouping: "DAY",
        analyticsAvailableFrom: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toThrowError(/INVALID_REPORT_RANGE/u);
  });

  it("returns an explicit not-applicable rate for a zero denominator", () => {
    expect(makeMetricRate(0, 0)).toEqual({
      numerator: 0,
      denominator: 0,
      value: null,
      availability: "NOT_APPLICABLE",
    });
  });
});
