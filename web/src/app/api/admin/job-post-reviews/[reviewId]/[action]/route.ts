import {
  adminJson,
  adminRouteError,
  AdminHttpError,
  commandHeaders,
  parseAdminJson,
} from "@/backend/admin/http/admin-route";
import { JobPostReviewService } from "@/backend/jobs/review/job-post-review-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminReviewCommandSchema } from "@/shared/contracts/admin/job-post-review";

export async function POST(
  request: Request,
  context: { params: Promise<{ reviewId: string; action: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request, {
      sensitive: true,
    });
    const { reviewId, action } = await context.params;
    if (
      !reviewId ||
      reviewId.length > 128 ||
      !["claim", "reassign", "approve", "reject"].includes(action)
    )
      throw new AdminHttpError(404, "TARGET_UNAVAILABLE");
    const command = await parseAdminJson(request, adminReviewCommandSchema);
    const expectedCommand = {
      claim: "CLAIM",
      reassign: "REASSIGN",
      approve: "APPROVE",
      reject: "REJECT",
    }[action];
    if (command.command !== expectedCommand)
      throw new AdminHttpError(422, "COMMAND_PATH_MISMATCH");
    const headers = commandHeaders(request, { strictIfMatch: true });
    if (
      headers.idempotencyKey.length < 16 ||
      headers.idempotencyKey.length > 128 ||
      !Number.isSafeInteger(headers.expectedVersion) ||
      headers.expectedVersion < 1
    )
      throw new AdminHttpError(422, "VALIDATION_FAILED");
    const service = new JobPostReviewService();
    if (command.command === "CLAIM" || command.command === "REASSIGN")
      return adminJson(
        await service.assign({
          authority,
          reviewId,
          command,
          expectedVersion: headers.expectedVersion,
          idempotencyKey: headers.idempotencyKey,
        }),
      );
    return adminJson(
      await service.decide({
        authority,
        reviewId,
        command,
        expectedVersion: headers.expectedVersion,
        idempotencyKey: headers.idempotencyKey,
      }),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
