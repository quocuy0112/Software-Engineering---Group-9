import {
  adminListQuery,
  adminJson,
  adminRouteError,
} from "@/backend/admin/http/admin-route";
import { AdminMembershipService } from "@/backend/admin/memberships/admin-membership-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export async function GET(request: Request) {
  try {
    await new AdminRequestBoundary().require(request);
    return adminJson(
      await new AdminMembershipService().companies(adminListQuery(request)),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
