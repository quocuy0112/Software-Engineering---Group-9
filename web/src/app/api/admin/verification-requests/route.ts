import {
  adminListQuery,
  adminJson,
  adminRouteError,
} from "@/backend/admin/http/admin-route";
import { VerificationReviewService } from "@/backend/admin/verification/verification-review-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export async function GET(request: Request) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    return adminJson(
      await new VerificationReviewService().list({
        ...adminListQuery(request),
        adminUserId: authority.userId,
      }),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
