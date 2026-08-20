import {
  RecruitmentMessagingError,
  RecruitmentMessagingService,
} from "@/backend/recruitment-messaging/recruitment-messaging-service";
import {
  AccountRequestError,
  accountErrorResponse,
  accountJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const actor = await requireAccountRequest(request, { mutation: true });
    return accountJson(
      await new RecruitmentMessagingService().openForStaff(
        (await context.params).applicationId,
        actor.userId,
      ),
    );
  } catch (error) {
    if (error instanceof AccountRequestError)
      return accountErrorResponse(error);
    if (error instanceof RecruitmentMessagingError)
      return accountJson({ code: error.code }, { status: error.status });
    return accountJson({ code: "VALIDATION_ERROR" }, { status: 400 });
  }
}
