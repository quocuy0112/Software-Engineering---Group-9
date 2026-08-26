import { RecruitmentMessagingError, RecruitmentMessagingService } from "@/backend/recruitment-messaging/recruitment-messaging-service";
import { AccountRequestError, accountErrorResponse, accountJson, parseBoundedJson, requireAccountRequest } from "@/backend/security/account-request-boundary";
import { recruitmentReportInputSchema } from "@/shared/contracts/recruitment-messaging";

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const actor = await requireAccountRequest(request, { mutation: true });
    const input = await parseBoundedJson(request, recruitmentReportInputSchema, 4 * 1024);
    const result = await new RecruitmentMessagingService().report((await context.params).threadId, actor.userId, input);
    return accountJson({ receipt: result.receipt }, { status: 202 });
  } catch (error) {
    if (error instanceof AccountRequestError) return accountErrorResponse(error);
    if (error instanceof RecruitmentMessagingError) return accountJson({ code: error.code }, { status: error.status });
    return accountJson({ code: "VALIDATION_ERROR" }, { status: 400 });
  }
}
