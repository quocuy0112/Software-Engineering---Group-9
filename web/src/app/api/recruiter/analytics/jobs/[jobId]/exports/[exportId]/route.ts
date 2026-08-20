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
  try {
    const current = await requireAccountRequest(request);
    const params = await context.params;
    const status = await new CandidateExportService().status({
      userId: current.userId,
      jobPostingId: params.jobId,
      exportId: params.exportId,
    });
    return accountJson(status);
  } catch (error) {
    return errorResponse(error);
  }
}
