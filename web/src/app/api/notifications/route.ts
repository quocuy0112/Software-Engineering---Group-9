import { requireAccountRequest, accountJson } from "@/backend/security/account-request-boundary";
import { createNotificationService } from "@/backend/notifications/notification-service-factory";
import { notificationRouteError } from "@/backend/notifications/notification-errors";
import {
  notificationListQuerySchema,
  notificationPageSchema,
} from "@/shared/contracts/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await requireAccountRequest(request);
    const query = new URL(request.url).searchParams;
    const input = notificationListQuerySchema.parse({
      cursor: query.get("cursor") ?? undefined,
      limit: query.get("limit") ?? undefined,
      state: query.get("state") ?? undefined,
      category: query.get("category") ?? undefined,
    });
    return accountJson(
      notificationPageSchema.parse(
        await createNotificationService().list(actor.userId, input),
      ),
    );
  } catch (error) {
    return notificationRouteError(error);
  }
}
