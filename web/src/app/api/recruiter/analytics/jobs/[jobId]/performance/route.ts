import "server-only";

import {
  accountErrorResponse,
  accountJson,
  requireAccountRequest,
  AccountRequestError,
} from "@/backend/security/account-request-boundary";
import {
  AnalyticsResourceUnavailableError,
  JobPerformanceService,
  ReportTimePolicyError,
} from "@/backend/analytics/job-performance-service";
import { jobPerformanceQuerySchema } from "@/shared/contracts/analytics/employer";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const current = await requireAccountRequest(request);
    const params = new URL(request.url).searchParams;
    const query = jobPerformanceQuerySchema.parse({
      from: params.get("from"),
      to: params.get("to"),
      timeZone: params.get("timeZone"),
    });
    const { jobId } = await context.params;
    return accountJson(
      await new JobPerformanceService().get(current.userId, jobId, query),
    );
  } catch (error) {
    if (error instanceof AccountRequestError)
      return accountErrorResponse(error);
    if (error instanceof ReportTimePolicyError) {
      return accountJson(
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
    if (error instanceof AnalyticsResourceUnavailableError) {
      return accountJson(
        {
          code: "TARGET_UNAVAILABLE",
          message: "The requested job posting is unavailable.",
        },
        { status: 404 },
      );
    }
    if (error && typeof error === "object" && "issues" in error) {
      return accountJson(
        { code: "VALIDATION_ERROR", message: "Review the report parameters." },
        { status: 400 },
      );
    }
    return accountErrorResponse(error);
  }
}
