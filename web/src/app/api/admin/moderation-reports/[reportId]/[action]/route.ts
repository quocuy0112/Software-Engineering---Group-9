import { z } from "zod";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import {
  adminJson,
  adminRouteError,
  AdminHttpError,
  commandHeaders,
  parseAdminJson,
} from "@/backend/admin/http/admin-route";
import { ModerationReviewService } from "@/backend/admin/moderation/moderation-review-service";
import { normalizedText } from "@/shared/contracts/admin/common";
const base = z.object({ confirmation: z.literal(true) }).strict();
const note = z
  .object({ confirmation: z.literal(true), note: normalizedText(1, 2000) })
  .strict();
const link = z
  .object({
    confirmation: z.literal(true),
    enforcementCorrelationId: z.string().min(8).max(128),
  })
  .strict();
export async function POST(
  request: Request,
  context: { params: Promise<{ reportId: string; action: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request, {
      sensitive: true,
    });
    const { reportId, action } = await context.params;
    if (
      !["assign", "note", "resolve", "dismiss", "link-enforcement"].includes(
        action,
      )
    )
      throw new AdminHttpError(404, "TARGET_UNAVAILABLE");
    const body = await parseAdminJson(
      request,
      action === "note" ? note : action === "link-enforcement" ? link : base,
    );
    const headers = commandHeaders(request);
    if (!headers.idempotencyKey || !Number.isInteger(headers.expectedVersion))
      throw new AdminHttpError(400, "VALIDATION_FAILED");
    return adminJson(
      await new ModerationReviewService().execute(
        authority,
        reportId,
        action as never,
        { ...body, ...headers },
      ),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
