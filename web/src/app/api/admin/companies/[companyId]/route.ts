import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AdminMembershipService } from "@/backend/admin/memberships/admin-membership-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export async function GET(
  request: Request,
  context: { params: Promise<{ companyId: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    const { companyId } = await context.params;
    return adminJson({
      data: await new AdminMembershipService().companyDetail(
        authority,
        companyId,
      ),
    });
  } catch (error) {
    return adminRouteError(error);
  }
}
