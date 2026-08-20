import { RecruitmentMessagingError, RecruitmentMessagingService } from "@/backend/recruitment-messaging/recruitment-messaging-service";
import { AccountRequestError, accountErrorResponse, accountJson, requireAccountRequest } from "@/backend/security/account-request-boundary";
import { recruitmentThreadQuerySchema } from "@/shared/contracts/recruitment-messaging";

export async function GET(request: Request) {
  try {
    const actor = await requireAccountRequest(request);
    const url = new URL(request.url);
    const query = recruitmentThreadQuerySchema.parse({ jobId: url.searchParams.get("jobId") ?? undefined, stage: url.searchParams.get("stage") ?? undefined, assignment: "all" });
    return accountJson({ items: await new RecruitmentMessagingService().ownerOverview(actor.userId, query) });
  } catch (error) {
    if (error instanceof AccountRequestError) return accountErrorResponse(error);
    if (error instanceof RecruitmentMessagingError) return accountJson({ code: error.code }, { status: error.status });
    return accountJson({ code: "VALIDATION_ERROR" }, { status: 400 });
  }
}
