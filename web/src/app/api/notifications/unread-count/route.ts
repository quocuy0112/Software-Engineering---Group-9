import { requireAccountRequest, accountJson } from "@/backend/security/account-request-boundary";
import { createNotificationService } from "@/backend/notifications/notification-service-factory";
import { notificationRouteError } from "@/backend/notifications/notification-errors";
import { notificationUnreadCountSchema } from "@/shared/contracts/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await requireAccountRequest(request);
    return accountJson(
      notificationUnreadCountSchema.parse(
        await createNotificationService().unreadCount(actor.userId),
      ),
    );
  } catch (error) {
    return notificationRouteError(error);
  }
}
