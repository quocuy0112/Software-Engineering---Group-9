import { requireAccountRequest, accountJson } from "@/backend/security/account-request-boundary";
import { createNotificationService } from "@/backend/notifications/notification-service-factory";
import { notificationRouteError } from "@/backend/notifications/notification-errors";
import { notificationReadMutationResultSchema } from "@/shared/contracts/notifications";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  try {
    const actor = await requireAccountRequest(request, { mutation: true });
    const { notificationId } = await context.params;
    return accountJson(
      notificationReadMutationResultSchema.parse(
        await createNotificationService().markRead(
          actor.userId,
          notificationId,
        ),
      ),
    );
  } catch (error) {
    return notificationRouteError(error);
  }
}
