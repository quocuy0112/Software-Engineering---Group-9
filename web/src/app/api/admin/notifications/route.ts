import { z } from "zod";
import { AdminNotificationService } from "@/backend/admin/notifications/admin-notification-service";
import {
  adminJson,
  adminListQuery,
  adminRouteError,
} from "@/backend/admin/http/admin-route";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { notificationCategorySchema } from "@/shared/contracts/notifications";

const filterSchema = z
  .object({
    state: z.enum(["all", "unread", "read"]).optional(),
    category: notificationCategorySchema.optional(),
  })
  .passthrough();

export async function GET(request: Request) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    const query = adminListQuery(request);
    const filter = filterSchema.parse(query.filter);
    return adminJson(
      await new AdminNotificationService().list(authority.userId, {
        page: query.page,
        perPage: query.perPage,
        state: filter.state ?? "all",
        category: filter.category,
      }),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
