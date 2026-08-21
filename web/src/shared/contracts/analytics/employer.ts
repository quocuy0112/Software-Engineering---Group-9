import { z } from "zod";
import {
  canonicalAnalyticsStageSchema,
  isoDateTime,
  metricRateSchema,
  reportMetadataSchema,
} from ".";

export const jobPerformanceQuerySchema = z
  .object({
    from: isoDateTime,
    to: isoDateTime,
    timeZone: z.string().trim().min(1).max(64),
  })
  .strict();
export type JobPerformanceQuery = z.infer<typeof jobPerformanceQuerySchema>;

export const funnelStageSchema = z
  .object({
    stage: canonicalAnalyticsStageSchema,
    count: z.number().int().nonnegative(),
    percentage: z.number().finite().min(0).max(100),
  })
  .strict();

export const jobPerformanceReportSchema = z
  .object({
    metadata: reportMetadataSchema,
    job: z.object({ id: z.string().min(1), title: z.string() }).strict(),
    qualifiedViews: z.number().int().nonnegative(),
    submittedApplications: z.number().int().nonnegative(),
    withdrawnApplications: z.number().int().nonnegative(),
    conversionRate: metricRateSchema,
    funnelAsOf: isoDateTime,
    funnel: z.array(funnelStageSchema).length(9),
  })
  .strict();
export type JobPerformanceReport = z.infer<typeof jobPerformanceReportSchema>;
