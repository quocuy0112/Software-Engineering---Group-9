import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { VerificationReviewService } from "@/backend/admin/verification/verification-review-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export async function GET(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    const data = await new VerificationReviewService().reviewDetail(
      (await context.params).requestId,
      authority.userId,
    );
    if (!data)
      return adminJson({ code: "TARGET_UNAVAILABLE" }, { status: 404 });
    return adminJson(data);
  } catch (error) {
    return adminRouteError(error);
  }
}
