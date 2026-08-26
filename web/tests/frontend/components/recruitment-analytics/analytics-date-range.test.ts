import { describe, expect, it, vi } from "vitest";
import {
  createAnalyticsDateRange,
  defaultAnalyticsDateRange,
  isValidAnalyticsDateRange,
} from "@/frontend/features/recruitment-analytics/analytics-date-range";
import { canonicalAnalyticsStages } from "@/shared/contracts/analytics";
import { fetchJobPerformance } from "@/frontend/features/recruitment-analytics/analytics-api";

describe("recruitment analytics date range", () => {
  it("keeps the visible end date inclusive while sending an exclusive API boundary", () => {
    const range = createAnalyticsDateRange("2026-08-20", "2026-08-20");

    expect(range.fromDate).toBe("2026-08-20");
    expect(range.toDate).toBe("2026-08-20");
    expect(range.from).toBe("2026-08-20T00:00:00+07:00");
    expect(range.to).toBe("2026-08-21T00:00:00+07:00");
  });

  it("accepts a same-day filter and produces a 30-day inclusive default", () => {
    expect(isValidAnalyticsDateRange("2026-08-20", "2026-08-20")).toBe(true);
    expect(isValidAnalyticsDateRange("2026-08-21", "2026-08-20")).toBe(false);

    const range = defaultAnalyticsDateRange(30);
    const from = new Date(range.fromDate + "T00:00:00.000Z");
    const to = new Date(range.toDate + "T00:00:00.000Z");
    const days = Math.round(
      (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000),
    );

    expect(days).toBe(29);
  });

  it("sends the next local midnight so applications on the visible end date are included", async () => {
    const responseReport = {
      metadata: {
        from: "2026-08-20T00:00:00+07:00",
        to: "2026-08-21T00:00:00+07:00",
        timeZone: "Asia/Ho_Chi_Minh",
        dataCutoff: "2026-08-20T12:00:00+07:00",
        definitionVersion: "recruitment-analytics-v1",
        analyticsAvailableFrom: "2026-01-01T00:00:00+07:00",
      },
      job: { id: "job-1", title: "Game Development" },
      qualifiedViews: 10,
      submittedApplications: 1,
      withdrawnApplications: 0,
      conversionRate: {
        numerator: 1,
        denominator: 10,
        value: 10,
        availability: "AVAILABLE",
      },
      funnelAsOf: "2026-08-20T12:00:00+07:00",
      funnel: canonicalAnalyticsStages.map((stage) => ({
        stage,
        count: stage === "APPLIED" ? 1 : 0,
        percentage: stage === "APPLIED" ? 100 : 0,
      })),
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseReport), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const range = createAnalyticsDateRange("2026-08-20", "2026-08-20");
    await fetchJobPerformance("job-1", range);

    const requestUrl = new URL(
      String(fetchMock.mock.calls[0]?.[0]),
      "http://localhost",
    );
    expect(requestUrl.searchParams.get("from")).toBe(
      "2026-08-20T00:00:00+07:00",
    );
    expect(requestUrl.searchParams.get("to")).toBe("2026-08-21T00:00:00+07:00");
  });

  it("retries a baseline-overlapping day from the available analytics instant", async () => {
    const responseReport = {
      metadata: {
        from: "2026-08-19T22:41:40.327Z",
        to: "2026-08-20T17:00:00.000Z",
        timeZone: "Asia/Ho_Chi_Minh",
        dataCutoff: "2026-08-20T12:00:00.000Z",
        definitionVersion: "recruitment-analytics-v1",
        analyticsAvailableFrom: "2026-08-19T22:41:40.327Z",
      },
      job: { id: "job-1", title: "Game Development" },
      qualifiedViews: 0,
      submittedApplications: 4,
      withdrawnApplications: 0,
      conversionRate: {
        numerator: 4,
        denominator: 0,
        value: null,
        availability: "NOT_APPLICABLE",
      },
      funnelAsOf: "2026-08-20T12:00:00.000Z",
      funnel: canonicalAnalyticsStages.map((stage) => ({
        stage,
        count: stage === "APPLIED" ? 4 : 0,
        percentage: stage === "APPLIED" ? 100 : 0,
      })),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "ANALYTICS_RANGE_UNAVAILABLE",
            details: {
              analyticsAvailableFrom: "2026-08-19T22:41:40.327Z",
            },
          }),
          { status: 404 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(responseReport), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const report = await fetchJobPerformance(
      "job-1",
      createAnalyticsDateRange("2026-08-20", "2026-08-20"),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryUrl = new URL(
      String(fetchMock.mock.calls[1]?.[0]),
      "http://localhost",
    );
    expect(retryUrl.searchParams.get("from")).toBe("2026-08-19T22:41:40.327Z");
    expect(report.submittedApplications).toBe(4);
  });

  it("keeps an older performance response usable during the report contract rollout", async () => {
    const responseReport = {
      metadata: {
        from: "2026-08-20T00:00:00+07:00",
        to: "2026-08-21T00:00:00+07:00",
        timeZone: "Asia/Ho_Chi_Minh",
        dataCutoff: "2026-08-20T12:00:00+07:00",
        definitionVersion: "recruitment-analytics-v1",
        analyticsAvailableFrom: "2026-01-01T00:00:00+07:00",
      },
      job: { id: "job-1", title: "Game Development" },
      qualifiedViews: 0,
      submittedApplications: 0,
      conversionRate: {
        numerator: 0,
        denominator: 0,
        value: null,
        availability: "NOT_APPLICABLE" as const,
      },
      funnelAsOf: "2026-08-20T12:00:00+07:00",
      funnel: canonicalAnalyticsStages.map((stage) => ({
        stage,
        count: 0,
        percentage: 0,
      })),
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseReport), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const report = await fetchJobPerformance(
      "job-1",
      createAnalyticsDateRange("2026-08-20", "2026-08-20"),
    );

    expect(report.withdrawnApplications).toBe(0);
  });
});
