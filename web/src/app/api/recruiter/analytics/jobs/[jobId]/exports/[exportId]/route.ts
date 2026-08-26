import "server-only";

import {
  accountErrorResponse,
  accountJson,
  AccountRequestError,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  CandidateExportService,
  ExportRequestError,
} from "@/backend/exports/candidate-export-service";
import { exportDownloadResponse } from "@/backend/exports/export-download-response";
import { noStoreHeaders } from "@/backend/security/response-headers";

type RouteContext = { params: Promise<{ jobId: string; exportId: string }> };

function errorResponse(error: unknown) {
  if (error instanceof AccountRequestError) return accountErrorResponse(error);
  if (error instanceof ExportRequestError) {
    return accountJson(
      {
        code: error.code,
        message:
          error.status === 404
            ? "The export request is unavailable."
            : "The export request cannot be downloaded.",
      },
      { status: error.status },
    );
  }
  return accountErrorResponse(error);
}

export async function GET(request: Request, context: RouteContext) {
  const downloadRequested = ["1", "true"].includes(
    new URL(request.url).searchParams.get("download") ?? "",
  );
  try {
    const current = await requireAccountRequest(request);
    const params = await context.params;
    const service = new CandidateExportService();
    if (downloadRequested) {
      const result = await service.download({
        userId: current.userId,
        actorSessionId: current.sessionId,
        jobPostingId: params.jobId,
        exportId: params.exportId,
      });
      return exportDownloadResponse(result);
    }
    const status = await service.status({
      userId: current.userId,
      jobPostingId: params.jobId,
      exportId: params.exportId,
    });
    return accountJson(status);
  } catch (error) {
    if (downloadRequested && error instanceof ExportRequestError) {
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
    return errorResponse(error);
  }
}
