import "server-only";

import { CandidateExportService, ExportRequestError } from "@/backend/exports/candidate-export-service";
import {
  accountErrorResponse,
  AccountRequestError,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import { noStoreHeaders } from "@/backend/security/response-headers";

type RouteContext = { params: Promise<{ jobId: string; exportId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const current = await requireAccountRequest(request);
    const params = await context.params;
    const result = await new CandidateExportService().download({
      userId: current.userId,
      actorSessionId: current.sessionId,
      jobPostingId: params.jobId,
      exportId: params.exportId,
    });
    const safeFileName = result.fileName.replaceAll(String.fromCharCode(34), "");
    const headers = new Headers(noStoreHeaders);
    headers.set("content-type", result.mediaType);
    headers.set(
      "content-disposition",
      "attachment; filename=" +
        String.fromCharCode(34) +
        safeFileName +
        String.fromCharCode(34),
    );
    headers.set("cache-control", "private, no-store");
    headers.set("content-length", String(result.body.byteLength));
    return new Response(new Uint8Array(result.body), { status: 200, headers });
  } catch (error) {
    if (error instanceof AccountRequestError) return accountErrorResponse(error);
    if (error instanceof ExportRequestError) {
      return Response.json(
        {
          code: error.code,
          message:
            error.status === 410
              ? "The export has expired."
              : "The export download is unavailable.",
        },
        { status: error.status, headers: noStoreHeaders },
      );
    }
    return accountErrorResponse(error);
  }
}
