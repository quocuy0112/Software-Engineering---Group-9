import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import {
  adminJson,
  adminRouteError,
  AdminHttpError,
} from "@/backend/admin/http/admin-route";
import { readAccountCommand } from "@/backend/admin/accounts/account-command-http";
import { AdminMembershipService } from "@/backend/admin/memberships/admin-membership-service";
export async function POST(
  request: Request,
  context: { params: Promise<{ membershipId: string; action: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request, {
      sensitive: true,
    });
    const { membershipId, action } = await context.params;
    const command = await readAccountCommand(request);
    const service = new AdminMembershipService();
    if (action === "suspend")
      return adminJson(await service.suspend(authority, membershipId, command));
    if (action === "restore")
      return adminJson(await service.restore(authority, membershipId, command));
    if (action === "remove")
      return adminJson(await service.remove(authority, membershipId, command));
    throw new AdminHttpError(404, "TARGET_UNAVAILABLE");
  } catch (error) {
    return adminRouteError(error);
  }
}
