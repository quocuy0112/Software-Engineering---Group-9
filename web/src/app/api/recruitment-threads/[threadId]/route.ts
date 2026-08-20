import { RecruitmentMessagingError, RecruitmentMessagingService } from "@/backend/recruitment-messaging/recruitment-messaging-service";
import { AccountRequestError, accountErrorResponse, accountJson, parseBoundedJson, requireAccountRequest } from "@/backend/security/account-request-boundary";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const actor = await requireAccountRequest(request);
    return accountJson(await new RecruitmentMessagingService().detail((await context.params).threadId, actor.userId));
  } catch (error) {
    if (error instanceof AccountRequestError) return accountErrorResponse(error);
    if (error instanceof RecruitmentMessagingError) return accountJson({ code: error.code }, { status: error.status });
    return accountJson({ code: "THREAD_UNAVAILABLE" }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const actor = await requireAccountRequest(request, { mutation: true });
    const command = await parseBoundedJson(request, z.object({ lastReadSequence: z.number().int().nonnegative() }).strict(), 1024);
    await new RecruitmentMessagingService().markRead((await context.params).threadId, actor.userId, command.lastReadSequence);
    return accountJson({ ok: true });
  } catch (error) {
    if (error instanceof AccountRequestError) return accountErrorResponse(error);
    if (error instanceof RecruitmentMessagingError) return accountJson({ code: error.code }, { status: error.status });
    return accountJson({ code: "VALIDATION_ERROR" }, { status: 400 });
  }
}
