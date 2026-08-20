import { describe, expect, it } from "vitest";
import { AdminAnalyticsService } from "@/backend/analytics/admin-analytics-service";
import {
  AnalyticsResourceUnavailableError,
  JobPerformanceService,
} from "@/backend/analytics/job-performance-service";

describe("recruitment analytics service aggregation contracts", () => {
  it("builds admin application-per-candidate and success rates from one aggregate", async () => {
    const baseline = new Date("2026-01-01T00:00:00.000Z");
    const service = new AdminAnalyticsService({
      analyticsAvailableFrom: async () => baseline,
      adminGrowth: async (range) =>
        new Map([
          [
            range.buckets[0]!.start.toISOString(),
            {
              newRegistrations: 4,
              activePostingsAtEnd: 2,
              submittedApplications: 4,
              distinctSubmittingCandidates: 2,
              hiredApplications: 1,
            },
          ],
        ]),
    });
    const report = await service.overview(
      {
        from: baseline.toISOString(),
        to: "2026-01-02T00:00:00.000Z",
        timeZone: "UTC",
        grouping: "DAY",
      },
      new Date("2026-01-03T00:00:00.000Z"),
    );
    expect(report.buckets[0]?.applicationsPerCandidate.value).toBe(200);
    expect(report.buckets[0]?.applicationSuccessRate.value).toBe(25);
  });

  it("enforces recruiter ownership before reading job performance data", async () => {
    const service = new JobPerformanceService(
      { employerJob: async () => null },
      {
        analyticsAvailableFrom: async () =>
          new Date("2026-01-01T00:00:00.000Z"),
        jobPerformance: async () => {
          throw new Error("must not query");
        },
      },
    );
    await expect(
      service.get(
        "recruiter-a",
        "job-owned-by-b",
        {
          from: "2026-01-01T00:00:00.000Z",
          to: "2026-01-02T00:00:00.000Z",
          timeZone: "UTC",
        },
        new Date("2026-01-03T00:00:00.000Z"),
      ),
    ).rejects.toBeInstanceOf(AnalyticsResourceUnavailableError);
  });
});
