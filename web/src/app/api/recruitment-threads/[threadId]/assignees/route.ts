import { RecruitmentMessagingError, RecruitmentMessagingService } from "@/backend/recruitment-messaging/recruitment-messaging-service";
import { AccountRequestError, accountErrorResponse, accountJson, requireAccountRequest } from "@/backend/security/account-request-boundary";

export async function GET(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const actor = await requireAccountRequest(request);
    return accountJson({ items: await new RecruitmentMessagingService().eligibleAssignees((await context.params).threadId, actor.userId) });
  } catch (error) {
    if (error instanceof AccountRequestError) return accountErrorResponse(error);
    if (error instanceof RecruitmentMessagingError) return accountJson({ code: error.code }, { status: error.status });
    return accountJson({ code: "THREAD_UNAVAILABLE" }, { status: 404 });
  }
}
