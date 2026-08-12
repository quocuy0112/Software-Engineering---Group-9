import { MessagingRequestBoundary } from "@/backend/messaging/authorization/messaging-request-boundary";
import { messagingJson, messagingRouteError, parseMessagingJson } from "@/backend/messaging/http/messaging-route";
import { MarkConversationReadService } from "@/backend/messaging/services/mark-conversation-read";
import { markReadInputSchema, readBoundarySchema } from "@/shared/contracts/messaging/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const actor = await new MessagingRequestBoundary().requireHttp(request);
    const { conversationId } = await params;
    const input = await parseMessagingJson(request, markReadInputSchema);
    const boundary = await new MarkConversationReadService().execute({
      conversationId,
      userId: actor.userId,
      lastReadSequence: input.lastReadSequence,
    });
    return messagingJson(readBoundarySchema.parse(boundary));
  } catch (error) {
    return messagingRouteError(error);
  }
}
