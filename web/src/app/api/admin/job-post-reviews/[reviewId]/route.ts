import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { JobPostReviewService } from "@/backend/jobs/review/job-post-review-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export async function GET(
  request: Request,
  context: { params: Promise<{ reviewId: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request, {
      sensitive: true,
    });
    const { reviewId } = await context.params;
    if (!reviewId || reviewId.length > 128)
      throw new Error("TARGET_UNAVAILABLE");
    return adminJson(
      await new JobPostReviewService().detail(authority, reviewId),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
