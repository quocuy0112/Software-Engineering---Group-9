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
    const inline =
      new URL(request.url).searchParams.get("disposition") === "inline";
    return new Response(Uint8Array.from(result.bytes), {
      headers: adminNoStoreHeaders({
        "content-type": inline ? result.mediaType : "application/octet-stream",
        "content-length": String(result.bytes.byteLength),
        "content-disposition": `${inline ? "inline" : "attachment"}; filename="${result.filename}"`,
        ...(inline
          ? {
              "content-security-policy":
                "sandbox; default-src 'none'; object-src 'none'; frame-ancestors 'none'",
            }
          : {}),
      }),
    });
  } catch (error) {
    return adminRouteError(error);
  }
}
