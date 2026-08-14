import { AdminNotificationService } from "@/backend/admin/notifications/admin-notification-service";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { notificationReadMutationResultSchema } from "@/shared/contracts/notifications";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    const { notificationId } = await context.params;
    return adminJson(
      notificationReadMutationResultSchema.parse(
        await new AdminNotificationService().markRead(
          authority.userId,
          notificationId,
        ),
      ),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
