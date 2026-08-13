import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { ProtectedProposalAuditService } from "@/backend/connections/services/protected-proposal-audit-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  try {
    await new AdminRequestBoundary().require(request, { sensitive: true });
    const data = await new ProtectedProposalAuditService().detail(
      (await context.params).proposalId,
    );
    return data
      ? adminJson({ data })
      : adminJson({ code: "TARGET_UNAVAILABLE" }, { status: 404 });
  } catch (error) {
    return adminRouteError(error);
  }
}
