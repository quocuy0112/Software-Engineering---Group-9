import {
  CvAccountRequestBoundary,
  cvJsonResponse,
} from "@/backend/security/cv-account-request-boundary";
import {
  cvHttpErrorResponse,
  CvImportServiceError,
} from "@/backend/services/cv-import/cv-http-errors";
import { ReceiveCvContentService } from "@/backend/services/cv-import/receive-cv-content";
import {
  cvIdempotencyKeySchema,
  cvUploadIdSchema,
} from "@/shared/contracts/cv-import/common";
import {
  cvContentAcceptedSchema,
  cvContentHeadersSchema,
} from "@/shared/contracts/cv-import/upload";

const boundary = new CvAccountRequestBoundary();

async function* bodyChunks(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return;
      yield chunk.value;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function PUT(
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
    const headers = cvContentHeadersSchema.safeParse({
      contentType: request.headers.get("content-type"),
      contentLength: request.headers.get("content-length"),
      idempotencyKey: request.headers.get("idempotency-key"),
    });
    if (!headers.success || !request.body)
      throw new CvImportServiceError("VALIDATION_ERROR");
    const key = cvIdempotencyKeySchema.parse(headers.data.idempotencyKey);
    const outcome = await new ReceiveCvContentService().execute({
      accountId: current.accountId,
      uploadId: id.data,
      contentType: headers.data.contentType,
      contentLength: headers.data.contentLength,
      idempotencyKey: key,
      body: bodyChunks(request.body),
    });
    const response = cvContentAcceptedSchema.parse({
      uploadId: outcome.uploadId,
      status: outcome.status,
      replayed: outcome.replayed,
      statusUrl: `/api/account/cv-imports/${outcome.uploadId}`,
    });
    return cvJsonResponse(response, {
      status: outcome.replayed ? 200 : 202,
      headers: { Location: response.statusUrl },
    });
  } catch (error) {
    return cvHttpErrorResponse(
      error,
      request.headers.get("x-request-id") ?? undefined,
    );
  }
}
