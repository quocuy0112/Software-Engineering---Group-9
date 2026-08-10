import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { PrivilegedRationaleService } from "@/backend/admin/rationales/privileged-rationale-service";
export async function GET(
  request: Request,
  context: { params: Promise<{ correlationId: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request, {
      sensitive: true,
    });
    const rationale = await new PrivilegedRationaleService().read(
      (await context.params).correlationId,
      new Date(),
      authority.proofAt,
    );
    if (rationale === null)
      return adminJson({ code: "TARGET_UNAVAILABLE" }, { status: 404 });
    return adminJson({ rationale });
  } catch (error) {
    return adminRouteError(error);
  }
}
