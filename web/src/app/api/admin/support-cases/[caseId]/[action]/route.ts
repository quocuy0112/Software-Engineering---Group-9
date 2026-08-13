import { z } from "zod";
import {
  supportCaseCommandInputSchema,
  supportNoteInputSchema,
  supportReassignInputSchema,
  sendSupportMessageInputSchema,
} from "@/shared/contracts/support";
import {
  adminJson,
  adminRouteError,
  commandHeaders,
  parseAdminJson,
} from "@/backend/admin/http/admin-route";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { AdminSupportService } from "@/backend/support/services/admin-support-service";

const actionSchema = z.enum([
  "claim",
  "reassign",
  "reply",
  "note",
  "resolve",
  "close",
]);
const replySchema = sendSupportMessageInputSchema.omit({
  expectedVersion: true,
});

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string; action: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    const params = await context.params;
    const action = actionSchema.parse(params.action);
    const headers = commandHeaders(request);
    if (
      !z.uuid().safeParse(headers.idempotencyKey).success ||
      !Number.isInteger(headers.expectedVersion)
    ) {
      return adminJson({ code: "VALIDATION_FAILED" }, { status: 400 });
    }
    let body: Record<string, unknown>;
    if (action === "reassign") {
      body = await parseAdminJson(request, supportReassignInputSchema);
    } else if (action === "reply") {
      body = await parseAdminJson(request, replySchema);
    } else if (action === "note") {
      body = await parseAdminJson(request, supportNoteInputSchema);
    } else {
      body = await parseAdminJson(request, supportCaseCommandInputSchema);
    }
    return adminJson(
      await new AdminSupportService().execute(authority, params.caseId, {
        action,
        body,
        expectedVersion: headers.expectedVersion,
        idempotencyKey: headers.idempotencyKey,
      }),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
