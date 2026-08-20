import "server-only";

import {
  accountErrorResponse,
  accountJson,
  AccountRequestError,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  CandidateExportService,
  ExportRequestError,
} from "@/backend/exports/candidate-export-service";
import { createExportRequestSchema } from "@/shared/contracts/analytics/exports";

type RouteContext = { params: Promise<{ jobId: string }> };

function routeError(error: unknown) {
  if (error instanceof AccountRequestError) return accountErrorResponse(error);
  if (error instanceof ExportRequestError) {
    const message =
      error.code === "IDEMPOTENCY_KEY_INVALID"
        ? "Provide a valid Idempotency-Key."
        : error.code === "IDEMPOTENCY_CONFLICT"
          ? "The idempotency key was already used for another export."
          : error.code === "TARGET_UNAVAILABLE"
            ? "The requested job posting is unavailable."
            : "The export request could not be completed.";
    return accountJson({ code: error.code, message }, { status: error.status });
  }
  return accountErrorResponse(error);
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const current = await requireAccountRequest(request, { mutation: true });
    const idempotencyKey = request.headers.get("idempotency-key") ?? "";
    const body = await parseBoundedJson(request, createExportRequestSchema, 8 * 1024);
    const { jobId } = await context.params;
    const status = await new CandidateExportService().request({
      userId: current.userId,
      actorSessionId: current.sessionId,
      jobPostingId: jobId,
      idempotencyKey,
      body,
    });
    return accountJson(status, { status: 202 });
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return accountJson(
        { code: "VALIDATION_ERROR", message: "Review the export format." },
        { status: 400 },
      );
    }
    return routeError(error);
  }
}
