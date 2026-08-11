import { DashboardSnapshotService } from "@/backend/admin/dashboard/dashboard-snapshot-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";

export async function GET(request: Request) {
  try {
    await new AdminRequestBoundary().require(request);
    return adminJson(await new DashboardSnapshotService().ensureCurrent());
  } catch (error) {
    return adminRouteError(error);
  }
}
