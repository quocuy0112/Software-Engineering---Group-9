import { RecruitmentMessagingError, RecruitmentMessagingService } from "@/backend/recruitment-messaging/recruitment-messaging-service";
import { AccountRequestError, accountErrorResponse, accountJson, requireAccountRequest } from "@/backend/security/account-request-boundary";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const actor = await requireAccountRequest(request);
    return accountJson(await new RecruitmentMessagingService().detailForApplication((await context.params).applicationId, actor.userId));
  } catch (error) {
    if (error instanceof AccountRequestError) return accountErrorResponse(error);
    if (error instanceof RecruitmentMessagingError) return accountJson({ code: error.code }, { status: error.status });
    return accountJson({ code: "THREAD_UNAVAILABLE" }, { status: 404 });
  }
}
