import { MessagingRequestBoundary } from "@/backend/messaging/authorization/messaging-request-boundary";
import { messagingJson, messagingRouteError } from "@/backend/messaging/http/messaging-route";
import { GetMessageHistoryService } from "@/backend/messaging/services/get-message-history";
import { messageHistoryQuerySchema, messageHistorySchema } from "@/shared/contracts/messaging/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const actor = await new MessagingRequestBoundary().requireHttp(request);
    const { conversationId } = await params;
    const url = new URL(request.url);
    const query = messageHistoryQuerySchema.parse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const history = await new GetMessageHistoryService().execute({
      conversationId,
      userId: actor.userId,
      ...query,
    });
    return messagingJson(messageHistorySchema.parse(history));
  } catch (error) {
    return messagingRouteError(error);
  }
}
