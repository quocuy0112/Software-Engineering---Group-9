import { AdminAuditQueryService } from "@/backend/admin/audit/admin-audit-query-service";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export async function GET(
  request: Request,
  context: { params: Promise<{ correlationId: string }> },
) {
  try {
    await new AdminRequestBoundary().require(request);
    const events = await new AdminAuditQueryService().byCorrelation(
      (await context.params).correlationId,
    );
    return adminJson({ data: events });
  } catch (error) {
    return adminRouteError(error);
  }
}
