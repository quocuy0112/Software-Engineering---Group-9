import {
  adminJson,
  adminListQuery,
  adminRouteError,
} from "@/backend/admin/http/admin-route";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { AdminSupportService } from "@/backend/support/services/admin-support-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await new AdminRequestBoundary().require(request);
    return adminJson(
      await new AdminSupportService().list(adminListQuery(request)),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
