import { z } from "zod";
import { MessagingRequestBoundary } from "@/backend/messaging/authorization/messaging-request-boundary";
import { MessagingError } from "@/backend/messaging/messaging-errors";
import {
  messagingJson,
  messagingRouteError,
  parseMessagingJson,
} from "@/backend/messaging/http/messaging-route";
import { OpenConversationService } from "@/backend/messaging/services/open-conversation";
import { admitMessagingRequest } from "@/backend/messaging/services/messaging-rate-limit";
import { GetConversationDetailService } from "@/backend/messaging/services/get-conversation-detail";
import {
  conversationDetailSchema,
  conversationListSchema,
  openConversationInputSchema,
} from "@/shared/contracts/messaging/conversations";
import { messagingListQuerySchema } from "@/shared/contracts/messaging/conversations";
import { ListConversationsService } from "@/backend/messaging/services/list-conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idempotencyKeySchema = z.uuid();

export async function GET(request: Request) {
  try {
    const actor = await new MessagingRequestBoundary().requireHttp(request);
    const url = new URL(request.url);
    const query = messagingListQuerySchema.parse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const page = await new ListConversationsService().execute({
      userId: actor.userId,
      cursor: query.cursor,
      limit: query.limit,
    });
    return messagingJson(conversationListSchema.parse(page));
  } catch (error) {
    return messagingRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await new MessagingRequestBoundary().requireHttp(request);
    if (!idempotencyKeySchema.safeParse(request.headers.get("idempotency-key")).success) {
      throw new MessagingError("VALIDATION_ERROR", 400);
    }
    await admitMessagingRequest("messagingConversationCreate", actor.userId);
    const input = await parseMessagingJson(request, openConversationInputSchema);
    const outcome = await new OpenConversationService().execute(
      actor,
      input.targetUserId,
      input.context,
    );
    const detail = await new GetConversationDetailService().execute(
      outcome.conversationId,
      actor.userId,
    );
    return messagingJson(conversationDetailSchema.parse(detail), {
      status: outcome.created ? 201 : 200,
    });
  } catch (error) {
    return messagingRouteError(error);
  }
}
