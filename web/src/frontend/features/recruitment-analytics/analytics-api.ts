import {
  jobPerformanceReportSchema,
  type JobPerformanceReport,
} from "@/shared/contracts/analytics/employer";
import type { AnalyticsDateRange } from "./analytics-date-range";

export class AnalyticsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly analyticsAvailableFrom?: string,
  ) {
    super(message);
  }
}

async function readResponseBody(response: Response) {
  return (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
    details?: {
      analyticsAvailableFrom?: unknown;
    };
  } | null;
}

function formatAnalyticsAvailability(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function fetchJobPerformance(
  jobId: string,
  range: AnalyticsDateRange,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    from: range.from,
    to: range.to,
    timeZone: range.timeZone,
  });
  const response = await fetch(
    "/api/recruiter/analytics/jobs/" +
      encodeURIComponent(jobId) +
      "/performance?" +
      query.toString(),
    { cache: "no-store", signal },
  );
  const body = await readResponseBody(response);
  if (!response.ok) {
    const code = typeof body?.code === "string" ? body.code : undefined;
    const analyticsAvailableFrom =
      typeof body?.details?.analyticsAvailableFrom === "string"
        ? body.details.analyticsAvailableFrom
        : undefined;
    const message =
      typeof body?.message === "string"
        ? body.message
        : code === "ANALYTICS_RANGE_UNAVAILABLE"
          ? "This date range is not available yet."
          : "This posting's analytics are unavailable.";
    const availabilityMs = analyticsAvailableFrom
      ? Date.parse(analyticsAvailableFrom)
      : Number.NaN;
    const requestedFromMs = Date.parse(range.from);
    const requestedToMs = Date.parse(range.to);
    if (
      code === "ANALYTICS_RANGE_UNAVAILABLE" &&
      Number.isFinite(availabilityMs) &&
      requestedFromMs < availabilityMs &&
      availabilityMs < requestedToMs
    ) {
      return fetchJobPerformance(
        jobId,
        {
          ...range,
          from: new Date(availabilityMs).toISOString(),
        },
        signal,
      );
    }
    throw new AnalyticsApiError(
      code === "ANALYTICS_RANGE_UNAVAILABLE" && analyticsAvailableFrom
        ? "Analytics are available from " +
            formatAnalyticsAvailability(analyticsAvailableFrom) +
            ". Choose a window that ends after this time."
        : message,
      response.status,
      code,
      analyticsAvailableFrom,
    );
  }
  return jobPerformanceReportSchema.parse(body) as JobPerformanceReport;
}

export async function readAnalyticsError(response: Response) {
  const body = await readResponseBody(response);
  return {
    code: typeof body?.code === "string" ? body.code : undefined,
    message:
      typeof body?.message === "string"
        ? body.message
        : "The analytics request could not be completed.",
  };
}
