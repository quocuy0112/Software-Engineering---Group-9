import { RecruitmentMessagingError, RecruitmentMessagingService } from "@/backend/recruitment-messaging/recruitment-messaging-service";
import { AccountRequestError, accountErrorResponse, accountJson, parseBoundedJson, requireAccountRequest } from "@/backend/security/account-request-boundary";
import { recruitmentAssignmentInputSchema } from "@/shared/contracts/recruitment-messaging";

export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const actor = await requireAccountRequest(request, { mutation: true });
    const input = await parseBoundedJson(request, recruitmentAssignmentInputSchema, 1024);
    return accountJson(await new RecruitmentMessagingService().assign((await context.params).applicationId, actor.userId, input));
  } catch (error) {
    if (error instanceof AccountRequestError) return accountErrorResponse(error);
    if (error instanceof RecruitmentMessagingError) return accountJson({ code: error.code }, { status: error.status });
    return accountJson({ code: "VALIDATION_ERROR" }, { status: 400 });
  }
}
