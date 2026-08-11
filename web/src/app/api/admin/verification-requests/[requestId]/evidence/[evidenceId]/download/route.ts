import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import {
  adminNoStoreHeaders,
  adminRouteError,
} from "@/backend/admin/http/admin-route";
import { EvidenceAccessService } from "@/backend/admin/verification/evidence-access-service";
export async function GET(
  request: Request,
  context: { params: Promise<{ requestId: string; evidenceId: string }> },
) {
  try {
    await new AdminRequestBoundary().require(request, { sensitive: true });
    const p = await context.params;
    const result = await new EvidenceAccessService().read(
      p.requestId,
      p.evidenceId,
    );
    return new Response(result.bytes, {
      headers: adminNoStoreHeaders({
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="${result.filename}"`,
      }),
    });
  } catch (error) {
    return adminRouteError(error);
  }
}
