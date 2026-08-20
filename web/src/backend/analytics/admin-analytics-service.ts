import "server-only";

import {
  adminGrowthReportSchema,
  type AdminOverviewQuery,
  type AdminGrowthReport,
} from "@/shared/contracts/analytics/admin";
import { ANALYTICS_DEFINITION_VERSION } from "@/shared/contracts/analytics";
import { calculateApplicationsPerCandidate } from "./analytics-calculations";
import {
  normalizeReportRange,
  type NormalizedReportRange,
  ReportTimePolicyError,
} from "./report-time-policy";
import {
  PrismaAnalyticsRepository,
  type AdminGrowthRepositoryResult,
} from "@/backend/repositories/analytics/prisma-analytics-repository";

type AdminAnalyticsRepository = Pick<
  PrismaAnalyticsRepository,
  "analyticsAvailableFrom" | "adminGrowth"
>;

export class AdminAnalyticsService {
  constructor(
    private readonly repository: AdminAnalyticsRepository = new PrismaAnalyticsRepository(),
  ) {}

  async overview(
    query: AdminOverviewQuery,
    now = new Date(),
  ): Promise<AdminGrowthReport> {
    const availableFrom = await this.repository.analyticsAvailableFrom();
    const range = normalizeReportRange({
      from: new Date(query.from),
      to: new Date(query.to),
      timeZone: query.timeZone,
      grouping: query.grouping,
      now,
      analyticsAvailableFrom: availableFrom,
    });
    const aggregate = await this.repository.adminGrowth(range);
    return adminGrowthReportSchema.parse({
      metadata: metadata(range),
      grouping: range.grouping,
      buckets: range.buckets.map((bucket) => {
        const value = aggregate.get(bucket.start.toISOString()) ?? emptyAggregate();
        return {
          start: bucket.start.toISOString(),
          end: bucket.end.toISOString(),
          newRegistrations: value.newRegistrations,
          activePostingsAtEnd: value.activePostingsAtEnd,
          submittedApplications: value.submittedApplications,
          distinctSubmittingCandidates: value.distinctSubmittingCandidates,
          applicationsPerCandidate: calculateApplicationsPerCandidate(
            value.submittedApplications,
            value.distinctSubmittingCandidates,
          ),
          applicationSuccessRate: {
            numerator: value.hiredApplications,
            denominator: value.submittedApplications,
            value:
              value.submittedApplications === 0
                ? null
                : Math.round(
                    (value.hiredApplications / value.submittedApplications) *
                      10000,
                  ) / 100,
            availability:
              value.submittedApplications === 0
                ? "NOT_APPLICABLE"
                : "AVAILABLE",
          },
        };
      }),
    });
  }
}

function emptyAggregate(): AdminGrowthRepositoryResult {
  return {
    newRegistrations: 0,
    submittedApplications: 0,
    distinctSubmittingCandidates: 0,
    hiredApplications: 0,
    activePostingsAtEnd: 0,
  };
}

function metadata(range: NormalizedReportRange) {
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    timeZone: range.timeZone,
    dataCutoff: range.dataCutoff.toISOString(),
    definitionVersion: ANALYTICS_DEFINITION_VERSION,
    analyticsAvailableFrom: range.analyticsAvailableFrom.toISOString(),
  };
}

export { ReportTimePolicyError };
