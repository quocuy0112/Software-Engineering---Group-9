import { AdminNotificationService } from "@/backend/admin/notifications/admin-notification-service";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { notificationReadMutationResultSchema } from "@/shared/contracts/notifications";

export async function POST(request: Request) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    return adminJson(
      notificationReadMutationResultSchema.parse(
        await new AdminNotificationService().markAllRead(authority.userId),
      ),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
