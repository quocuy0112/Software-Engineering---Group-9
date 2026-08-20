import { z } from "zod";

export const ANALYTICS_DEFINITION_VERSION =
  "recruitment-analytics-v1" as const;
export const ANALYTICS_VISITOR_DIGEST_VERSION = 1 as const;
export const ANALYTICS_QUALIFICATION_POLICY_VERSION =
  "qualified-view-v1" as const;
export const ANALYTICS_PLATFORM_TIME_ZONE = "Asia/Ho_Chi_Minh" as const;

export const analyticsGroupingSchema = z.enum(["DAY", "WEEK", "MONTH"]);
export type AnalyticsGrouping = z.infer<typeof analyticsGroupingSchema>;

export const analyticsViewQualificationSchema = z.enum([
  "QUALIFIED",
  "OWNER_PREVIEW",
  "AUTOMATED",
  "INVALID",
]);
export type AnalyticsViewQualification = z.infer<
  typeof analyticsViewQualificationSchema
>;

export const canonicalAnalyticsStages = [
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "INTERVIEWING",
  "OFFERED",
  "HIRED",
  "OFFER_DECLINED",
  "REJECTED",
  "WAITLISTED",
] as const;
export const canonicalAnalyticsStageSchema = z.enum(canonicalAnalyticsStages);
export type CanonicalAnalyticsStage = z.infer<
  typeof canonicalAnalyticsStageSchema
>;

const isoDateTime = z.string().datetime({ offset: true });

export const reportMetadataSchema = z
  .object({
    from: isoDateTime,
    to: isoDateTime,
    timeZone: z.string().min(1).max(64),
    dataCutoff: isoDateTime,
    definitionVersion: z.string().min(1).max(100),
    analyticsAvailableFrom: isoDateTime,
  })
  .strict();
export type ReportMetadata = z.infer<typeof reportMetadataSchema>;

export const metricRateSchema = z
  .object({
    numerator: z.number().int().nonnegative(),
    denominator: z.number().int().nonnegative(),
    value: z.number().finite().nonnegative().nullable(),
    availability: z.enum(["AVAILABLE", "NOT_APPLICABLE"]),
  })
  .strict();
export type MetricRate = z.infer<typeof metricRateSchema>;

export { isoDateTime };
