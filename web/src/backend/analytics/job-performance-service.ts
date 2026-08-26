import "server-only";

import {
  jobPerformanceReportSchema,
  type JobPerformanceQuery,
  type JobPerformanceReport,
} from "@/shared/contracts/analytics/employer";
import { ANALYTICS_DEFINITION_VERSION } from "@/shared/contracts/analytics";
import { AnalyticsAuthorization } from "./analytics-authorization";
import {
  calculateConversionRate,
  calculateFunnel,
} from "./analytics-calculations";
import {
  normalizeReportRange,
  ReportTimePolicyError,
} from "./report-time-policy";
import { PrismaAnalyticsRepository } from "@/backend/repositories/analytics/prisma-analytics-repository";

export class AnalyticsResourceUnavailableError extends Error {
  readonly status = 404;
  readonly code = "TARGET_UNAVAILABLE";
}

type JobAnalyticsRepository = Pick<
  PrismaAnalyticsRepository,
  "analyticsAvailableFrom" | "jobPerformance"
>;

export class JobPerformanceService {
  constructor(
    private readonly authorization: Pick<
      AnalyticsAuthorization,
      "employerJob"
    > = new AnalyticsAuthorization(),
    private readonly repository: JobAnalyticsRepository = new PrismaAnalyticsRepository(),
  ) {}

  async get(
    userId: string,
    jobPostingId: string,
    query: JobPerformanceQuery,
    now = new Date(),
  ): Promise<JobPerformanceReport> {
    const scope = await this.authorization.employerJob(userId, jobPostingId);
    if (!scope) throw new AnalyticsResourceUnavailableError();
    const availableFrom = await this.repository.analyticsAvailableFrom();
    const range = normalizeReportRange({
      from: new Date(query.from),
      to: new Date(query.to),
      timeZone: query.timeZone,
      grouping: "DAY",
      now,
      analyticsAvailableFrom: availableFrom,
    });
    const aggregate = await this.repository.jobPerformance({
      jobPostingId: scope.jobPostingId,
      from: range.from,
      to: range.to,
      dataCutoff: range.dataCutoff,
    });
    return jobPerformanceReportSchema.parse({
      metadata: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timeZone: range.timeZone,
        dataCutoff: range.dataCutoff.toISOString(),
        definitionVersion: ANALYTICS_DEFINITION_VERSION,
        analyticsAvailableFrom: range.analyticsAvailableFrom.toISOString(),
      },
      job: { id: scope.jobPostingId, title: scope.jobTitle },
      qualifiedViews: aggregate.qualifiedViews,
      submittedApplications: aggregate.submittedApplications,
      withdrawnApplications: aggregate.withdrawnApplications,
      conversionRate: calculateConversionRate(
        aggregate.submittedApplications,
        aggregate.qualifiedViews,
      ),
      funnelAsOf: range.dataCutoff.toISOString(),
      funnel: calculateFunnel(aggregate.funnelCounts),
    });
  }
}

export { ReportTimePolicyError };
