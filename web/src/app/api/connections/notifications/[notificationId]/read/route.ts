import { z } from "zod";
import { ConnectionRequestBoundary } from "@/backend/connections/authorization/connection-request-boundary";
import { connectionRouteError } from "@/backend/connections/http/connection-route";
import { ConnectionNotificationService } from "@/backend/connections/services/connection-notification-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  try {
    const actor = await new ConnectionRequestBoundary().requireHttp(request);
    const idempotencyKey = request.headers.get("idempotency-key") ?? "";
    if (!z.uuid().safeParse(idempotencyKey).success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR" } },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
    await new ConnectionNotificationService().markRead(
      actor,
      (await context.params).notificationId,
      idempotencyKey,
    );
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store", pragma: "no-cache" },
    });
  } catch (error) {
    return connectionRouteError(error);
  }
}
