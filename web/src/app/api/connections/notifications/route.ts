import { connectionNotificationListSchema } from "@/shared/contracts/connections";
import { ConnectionRequestBoundary } from "@/backend/connections/authorization/connection-request-boundary";
import {
  connectionJson,
  connectionRouteError,
} from "@/backend/connections/http/connection-route";
import { ConnectionNotificationService } from "@/backend/connections/services/connection-notification-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await new ConnectionRequestBoundary().requireHttp(request);
    const query = new URL(request.url).searchParams;
    const limit = Math.min(50, Math.max(1, Number(query.get("limit") ?? 20)));
    return connectionJson(
      connectionNotificationListSchema.parse(
        await new ConnectionNotificationService().list(actor.userId, {
          limit,
          cursor: query.get("cursor") ?? undefined,
        }),
      ),
    );
  } catch (error) {
    return connectionRouteError(error);
  }
}
