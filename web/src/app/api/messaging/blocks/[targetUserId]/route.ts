import { z } from "zod";
import { MessagingRequestBoundary } from "@/backend/messaging/authorization/messaging-request-boundary";
import { MessagingError } from "@/backend/messaging/messaging-errors";
import { messagingJson, messagingRouteError } from "@/backend/messaging/http/messaging-route";
import { BlockParticipantService } from "@/backend/messaging/services/block-participant";
import { UnblockParticipantService } from "@/backend/messaging/services/unblock-participant";
import { admitMessagingRequest } from "@/backend/messaging/services/messaging-rate-limit";
import { blockProjectionSchema } from "@/shared/contracts/messaging/safety";
import { opaqueIdSchema } from "@/shared/contracts/messaging/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ targetUserId: string }> },
) {
  try {
    const actor = await new MessagingRequestBoundary().requireHttp(request);
    if (!z.uuid().safeParse(request.headers.get("idempotency-key")).success) {
      throw new MessagingError("VALIDATION_ERROR", 400);
    }
    await admitMessagingRequest("messagingBlock", actor.userId);
    const targetUserId = opaqueIdSchema.parse((await params).targetUserId);
    return messagingJson(
      blockProjectionSchema.parse(
        await new BlockParticipantService().execute(actor, targetUserId),
      ),
    );
  } catch (error) {
    return messagingRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ targetUserId: string }> },
) {
  try {
    const actor = await new MessagingRequestBoundary().requireHttp(request);
    await admitMessagingRequest("messagingBlock", actor.userId);
    const targetUserId = opaqueIdSchema.parse((await params).targetUserId);
    return messagingJson(
      blockProjectionSchema.parse(
        await new UnblockParticipantService().execute(actor, targetUserId),
      ),
    );
  } catch (error) {
    return messagingRouteError(error);
  }
}
