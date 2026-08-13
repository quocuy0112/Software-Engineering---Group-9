import { sendSupportMessageInputSchema } from "@/shared/contracts/support";
import { SupportRequestBoundary } from "@/backend/support/authorization/support-request-boundary";
import {
  parseSupportJson,
  supportJson,
  supportRouteError,
} from "@/backend/support/http/support-route";
import { RequesterSupportService } from "@/backend/support/services/requester-support-service";
import {
  admitSupportRequest,
  supportNetworkSubject,
} from "@/backend/support/services/support-rate-limit";

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  try {
    const actor = await new SupportRequestBoundary().requireHttp(request);
    await Promise.all([
      admitSupportRequest("supportSend", actor.userId),
      admitSupportRequest("supportSendNetwork", supportNetworkSubject(request)),
    ]);
    const input = await parseSupportJson(
      request,
      sendSupportMessageInputSchema,
    );
    const result = await new RequesterSupportService().send(
      (await context.params).caseId,
      actor.userId,
      input,
    );
    return supportJson({
      data: result.detail,
      deduplicated: result.deduplicated,
    });
  } catch (error) {
    return supportRouteError(error);
  }
}
