import { RecruitmentMessagingError, RecruitmentMessagingService } from "@/backend/recruitment-messaging/recruitment-messaging-service";
import { AccountRequestError, accountErrorResponse, accountJson, parseBoundedJson, requireAccountRequest } from "@/backend/security/account-request-boundary";
import { recruitmentMessageInputSchema } from "@/shared/contracts/recruitment-messaging";
import { admitMessagingRequest } from "@/backend/messaging/services/messaging-rate-limit";
import { MessagingError } from "@/backend/messaging/messaging-errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const actor = await requireAccountRequest(request, { mutation: true });
    await admitMessagingRequest("messagingSend", actor.userId);
    const input = await parseBoundedJson(request, recruitmentMessageInputSchema, 8 * 1024);
    return accountJson(await new RecruitmentMessagingService().send((await context.params).threadId, actor.userId, input));
  } catch (error) {
    if (error instanceof AccountRequestError) return accountErrorResponse(error);
    if (error instanceof RecruitmentMessagingError) return accountJson({ code: error.code }, { status: error.status });
    if (error instanceof MessagingError) return accountJson({ code: error.code, retryAfterSeconds: error.retryAfterSeconds }, { status: error.status, headers: error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : undefined });
    return accountJson({ code: "VALIDATION_ERROR" }, { status: 400 });
  }
}
