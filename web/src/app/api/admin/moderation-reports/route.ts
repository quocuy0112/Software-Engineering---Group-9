import {
  adminListQuery,
  adminJson,
  adminRouteError,
} from "@/backend/admin/http/admin-route";
import { ModerationReviewService } from "@/backend/admin/moderation/moderation-review-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export async function GET(request: Request) {
  try {
    await new AdminRequestBoundary().require(request);
    return adminJson(
      await new ModerationReviewService().list(adminListQuery(request)),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
