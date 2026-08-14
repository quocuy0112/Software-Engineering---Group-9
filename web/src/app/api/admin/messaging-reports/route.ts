import {
  adminJson,
  adminListQuery,
  adminRouteError,
} from "@/backend/admin/http/admin-route";
import { AdminMessagingReportReviewService } from "@/backend/admin/messaging-reports/admin-messaging-report-review-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminMessagingReportListQuerySchema } from "@/shared/contracts/admin/messaging-reports";

export async function GET(request: Request) {
  try {
    await new AdminRequestBoundary().require(request);
    const query = adminMessagingReportListQuerySchema.parse(
      adminListQuery(request),
    );
    return adminJson(await new AdminMessagingReportReviewService().list(query));
  } catch (error) {
    return adminRouteError(error);
  }
}
