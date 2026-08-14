import { requireAccountRequest, accountJson } from "@/backend/security/account-request-boundary";
import { createNotificationService } from "@/backend/notifications/notification-service-factory";
import { notificationRouteError } from "@/backend/notifications/notification-errors";
import { notificationReadMutationResultSchema } from "@/shared/contracts/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await requireAccountRequest(request, { mutation: true });
    return accountJson(
      notificationReadMutationResultSchema.parse(
        await createNotificationService().markAllRead(actor.userId),
      ),
    );
  } catch (error) {
    return notificationRouteError(error);
  }
}
