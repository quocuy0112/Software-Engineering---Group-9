import { z } from "zod";
import {
  analyticsGroupingSchema,
  isoDateTime,
  metricRateSchema,
  reportMetadataSchema,
  type AnalyticsGrouping,
} from ".";

export const adminOverviewQuerySchema = z
  .object({
    from: isoDateTime,
    to: isoDateTime,
    timeZone: z.string().trim().min(1).max(64),
    grouping: analyticsGroupingSchema,
  })
  .strict();
export type AdminOverviewQuery = z.infer<typeof adminOverviewQuerySchema>;

export const adminGrowthBucketSchema = z
  .object({
    start: isoDateTime,
    end: isoDateTime,
    newRegistrations: z.number().int().nonnegative(),
    activePostingsAtEnd: z.number().int().nonnegative(),
    submittedApplications: z.number().int().nonnegative(),
    distinctSubmittingCandidates: z.number().int().nonnegative(),
    applicationsPerCandidate: metricRateSchema,
    applicationSuccessRate: metricRateSchema,
  })
  .strict();

export const adminGrowthReportSchema = z
  .object({
    metadata: reportMetadataSchema,
    grouping: analyticsGroupingSchema,
    buckets: z.array(adminGrowthBucketSchema),
  })
  .strict();
export type AdminGrowthReport = z.infer<typeof adminGrowthReportSchema>;

export type { AnalyticsGrouping };
