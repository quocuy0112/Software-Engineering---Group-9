import {
  CvAccountRequestBoundary,
  cvJsonResponse,
} from "@/backend/security/cv-account-request-boundary";
import {
  cvHttpErrorResponse,
  CvImportServiceError,
} from "@/backend/services/cv-import/cv-http-errors";
import { RetryCvImportService } from "@/backend/services/cv-import/retry-cv-import";
import { cvUploadIdSchema } from "@/shared/contracts/cv-import/common";
import {
  cvRetryAcceptedSchema,
  cvRetryHeadersSchema,
  cvRetryRequestSchema,
} from "@/shared/contracts/cv-import/retry";

type RetryBoundary = Pick<CvAccountRequestBoundary, "authorize" | "readJson">;
type RetryService = Pick<RetryCvImportService, "executeForHttp">;

export function createCvImportRetryPostHandler(dependencies?: {
  boundary?: RetryBoundary;
  service?: RetryService;
}) {
  const boundary = dependencies?.boundary ?? new CvAccountRequestBoundary();
  const service = dependencies?.service ?? new RetryCvImportService();
  return async function retryCvImportPost(
    request: Request,
    { params }: { params: Promise<{ uploadId: string }> },
  ): Promise<Response> {
    try {
      const id = cvUploadIdSchema.safeParse((await params).uploadId);
      if (!id.success) throw new CvImportServiceError("CV_IMPORT_NOT_FOUND");
      const current = await boundary.authorize(request, {
        mutation: true,
        resource: { type: "upload", id: id.data },
      });
      const headers = cvRetryHeadersSchema.safeParse({
        idempotencyKey: request.headers.get("idempotency-key"),
      });
      if (!headers.success) throw new CvImportServiceError("VALIDATION_ERROR");
      const declaredLength = request.headers.get("content-length");
      if (!request.body && declaredLength && declaredLength !== "0")
        throw new CvImportServiceError("VALIDATION_ERROR");
      const contentType = request.headers.get("content-type");
      if (
        !request.body &&
        contentType &&
        !contentType.toLowerCase().startsWith("application/json")
      )
        throw new CvImportServiceError("UNSUPPORTED_MEDIA_TYPE");
      const body = request.body
        ? await boundary.readJson(request, cvRetryRequestSchema, 256)
        : cvRetryRequestSchema.parse({});
      cvRetryRequestSchema.parse(body);
      const { outcome, replayed } = await service.executeForHttp({
        accountId: current.accountId,
        uploadId: id.data,
        idempotencyKey: headers.data.idempotencyKey,
      });
      return cvJsonResponse(cvRetryAcceptedSchema.parse(outcome), {
        status: replayed ? 200 : 202,
        headers: { "Retry-After": "1" },
      });
    } catch (error) {
      return cvHttpErrorResponse(
        error,
        request.headers.get("x-request-id") ?? undefined,
      );
    }
  };
}
