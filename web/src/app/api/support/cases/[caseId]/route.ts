import { supportCaseDetailSchema } from "@/shared/contracts/support";
import { SupportRequestBoundary } from "@/backend/support/authorization/support-request-boundary";
import {
  supportJson,
  supportRouteError,
} from "@/backend/support/http/support-route";
import { RequesterSupportService } from "@/backend/support/services/requester-support-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  try {
    const actor = await new SupportRequestBoundary().requireHttp(request);
    const data = await new RequesterSupportService().detail(
      (await context.params).caseId,
      actor.userId,
    );
    if (!data)
      return supportJson(
        { error: { code: "CASE_UNAVAILABLE" } },
        { status: 404 },
      );
    return supportJson({ data: supportCaseDetailSchema.parse(data) });
  } catch (error) {
    return supportRouteError(error);
  }
}
