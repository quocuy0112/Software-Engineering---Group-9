import {
  requireAccountRequest,
  accountJson,
  parseBoundedJson,
} from "@/backend/security/account-request-boundary";
import { createNotificationService } from "@/backend/notifications/notification-service-factory";
import { notificationRouteError } from "@/backend/notifications/notification-errors";
import {
  notificationContextReadSchema,
  notificationReadMutationResultSchema,
} from "@/shared/contracts/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await requireAccountRequest(request, { mutation: true });
    const input = await parseBoundedJson(
      request,
      notificationContextReadSchema,
      2_048,
    );
    return accountJson(
      notificationReadMutationResultSchema.parse(
        await createNotificationService().markContextRead(
          actor.userId,
          input.contextType,
          input.contextId,
        ),
      ),
    );
  } catch (error) {
    return notificationRouteError(error);
  }
}
