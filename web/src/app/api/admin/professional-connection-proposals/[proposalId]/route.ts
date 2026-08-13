import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AdminProposalService } from "@/backend/connections/services/admin-proposal-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  try {
    await new AdminRequestBoundary().require(request);
    const data = await new AdminProposalService().detail(
      (await context.params).proposalId,
    );
    return data
      ? adminJson({ data })
      : adminJson({ code: "TARGET_UNAVAILABLE" }, { status: 404 });
  } catch (error) {
    return adminRouteError(error);
  }
}
