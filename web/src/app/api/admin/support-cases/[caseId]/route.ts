import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { AdminSupportService } from "@/backend/support/services/admin-support-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  try {
    await new AdminRequestBoundary().require(request);
    const data = await new AdminSupportService().detail(
      (await context.params).caseId,
    );
    if (!data)
      return adminJson({ code: "TARGET_UNAVAILABLE" }, { status: 404 });
    return adminJson({ data });
  } catch (error) {
    return adminRouteError(error);
  }
}
