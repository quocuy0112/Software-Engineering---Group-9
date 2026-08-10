import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AdminMembershipService } from "@/backend/admin/memberships/admin-membership-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export async function GET(
  request: Request,
  context: { params: Promise<{ membershipId: string }> },
) {
  try {
    await new AdminRequestBoundary().require(request);
    const data = await new AdminMembershipService().detail(
      (await context.params).membershipId,
    );
    if (!data)
      return adminJson({ code: "TARGET_UNAVAILABLE" }, { status: 404 });
    return adminJson({ data });
  } catch (error) {
    return adminRouteError(error);
  }
}
