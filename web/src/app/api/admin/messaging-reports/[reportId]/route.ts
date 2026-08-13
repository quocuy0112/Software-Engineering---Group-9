import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AdminMessagingReportReviewService } from "@/backend/admin/messaging-reports/admin-messaging-report-review-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminReferenceSchema } from "@/shared/contracts/admin/common";

export async function GET(
  request: Request,
  context: { params: Promise<{ reportId: string }> },
) {
  try {
    await new AdminRequestBoundary().require(request, { sensitive: true });
    const reportId = adminReferenceSchema.parse((await context.params).reportId);
    const data = await new AdminMessagingReportReviewService().detail(reportId);
    if (!data) return adminJson({ code: "UNAVAILABLE" }, { status: 404 });
    return adminJson({ data });
  } catch (error) {
    return adminRouteError(error);
  }
}
