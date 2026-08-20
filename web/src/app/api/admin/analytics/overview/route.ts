import "server-only";

import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AdminAnalyticsService } from "@/backend/analytics/admin-analytics-service";
import { ReportTimePolicyError } from "@/backend/analytics/report-time-policy";
import { adminOverviewQuerySchema } from "@/shared/contracts/analytics/admin";

export async function GET(request: Request) {
  try {
    await new AdminRequestBoundary().require(request);
    const params = new URL(request.url).searchParams;
    const query = adminOverviewQuerySchema.parse({
      from: params.get("from"),
      to: params.get("to"),
      timeZone: params.get("timeZone"),
      grouping: params.get("grouping"),
    });
    return adminJson(await new AdminAnalyticsService().overview(query));
  } catch (error) {
    if (error instanceof ReportTimePolicyError) {
      return adminJson(
        {
          code: error.code,
          message:
            error.code === "ANALYTICS_RANGE_UNAVAILABLE"
              ? "Analytics are not available before the collection baseline."
              : "The requested report range is invalid.",
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.status },
      );
    }
    return adminRouteError(error);
  }
}
