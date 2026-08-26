import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { readVerificationCommand } from "@/backend/admin/verification/verification-command-http";
import { VerificationReviewService } from "@/backend/admin/verification/verification-review-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request, {
      sensitive: true,
    });
    return adminJson(
      await new VerificationReviewService().claim(
        authority,
        (await context.params).requestId,
        await readVerificationCommand(request, "claim"),
      ),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
