import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { ModerationReviewService } from "@/backend/admin/moderation/moderation-review-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export async function GET(
  request: Request,
  context: { params: Promise<{ reportId: string }> },
) {
  try {
    await new AdminRequestBoundary().require(request);
    const data = await new ModerationReviewService().detail(
      (await context.params).reportId,
    );
    if (!data)
      return adminJson({ code: "TARGET_UNAVAILABLE" }, { status: 404 });
    return adminJson({ data });
  } catch (error) {
    return adminRouteError(error);
  }
}
