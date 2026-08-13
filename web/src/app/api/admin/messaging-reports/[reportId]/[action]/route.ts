import {
  adminJson,
  adminRouteError,
  AdminHttpError,
  commandHeaders,
  parseAdminJson,
} from "@/backend/admin/http/admin-route";
import {
  AdminMessagingReportReviewService,
  type AdminMessagingReportAction,
} from "@/backend/admin/messaging-reports/admin-messaging-report-review-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import {
  adminMessagingReportConfirmedCommandSchema,
  adminMessagingReportEnforcementCommandSchema,
  adminMessagingReportNoteCommandSchema,
} from "@/shared/contracts/admin/messaging-reports";
import { adminReferenceSchema } from "@/shared/contracts/admin/common";

const actions = new Set<AdminMessagingReportAction>([
  "assign",
  "note",
  "resolve",
  "dismiss",
  "link-enforcement",
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ reportId: string; action: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request, {
      sensitive: true,
    });
    const params = await context.params;
    const reportId = adminReferenceSchema.parse(params.reportId);
    const action = params.action;
    if (!actions.has(action as AdminMessagingReportAction)) {
      throw new AdminHttpError(404, "UNAVAILABLE");
    }
    const body = await parseAdminJson(
      request,
      action === "note"
        ? adminMessagingReportNoteCommandSchema
        : action === "link-enforcement"
          ? adminMessagingReportEnforcementCommandSchema
          : adminMessagingReportConfirmedCommandSchema,
    );
    const headers = commandHeaders(request);
    if (!headers.idempotencyKey || !Number.isInteger(headers.expectedVersion)) {
      throw new AdminHttpError(400, "VALIDATION_FAILED");
    }
    return adminJson(
      await new AdminMessagingReportReviewService().execute(
        authority,
        reportId,
        action as AdminMessagingReportAction,
        { ...body, ...headers },
      ),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
