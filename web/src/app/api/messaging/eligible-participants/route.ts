import { MessagingRequestBoundary } from "@/backend/messaging/authorization/messaging-request-boundary";
import {
  messagingJson,
  messagingRouteError,
} from "@/backend/messaging/http/messaging-route";
import { FindEligibleParticipantsService } from "@/backend/messaging/services/find-eligible-participants";
import { admitMessagingRequest } from "@/backend/messaging/services/messaging-rate-limit";
import {
  eligibleParticipantListSchema,
  messagingListQuerySchema,
} from "@/shared/contracts/messaging/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await new MessagingRequestBoundary().requireHttp(request);
    await admitMessagingRequest("messagingDiscovery", actor.userId);
    const url = new URL(request.url);
    const query = messagingListQuerySchema.parse({
      q: url.searchParams.get("q") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const page = await new FindEligibleParticipantsService().execute({
      userId: actor.userId,
      ...query,
    });
    return messagingJson(eligibleParticipantListSchema.parse(page));
  } catch (error) {
    return messagingRouteError(error);
  }
}
