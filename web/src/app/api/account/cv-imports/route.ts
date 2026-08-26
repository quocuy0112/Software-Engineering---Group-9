import {
  CvAccountRequestBoundary,
  cvJsonResponse,
} from "@/backend/security/cv-account-request-boundary";
import { CreateCvImportService } from "@/backend/services/cv-import/create-cv-import";
import {
  cvHttpErrorResponse,
  CvImportServiceError,
} from "@/backend/services/cv-import/cv-http-errors";
import { listCvImports } from "@/backend/services/cv-import/cv-import-projection";
import { cvIdempotencyKeySchema } from "@/shared/contracts/cv-import/common";
import { createCvImportRequestSchema } from "@/shared/contracts/cv-import/upload";

const boundary = new CvAccountRequestBoundary();

export async function GET(request: Request): Promise<Response> {
  try {
    if (new URL(request.url).search)
      throw new CvImportServiceError("VALIDATION_ERROR");
    const current = await boundary.authorize(request);
    return cvJsonResponse(await listCvImports(current.accountId));
  } catch (error) {
    return cvHttpErrorResponse(
      error,
      request.headers.get("x-request-id") ?? undefined,
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const current = await boundary.authorize(request, { mutation: true });
    const key = cvIdempotencyKeySchema.safeParse(
      request.headers.get("idempotency-key"),
    );
    if (!key.success) throw new CvImportServiceError("VALIDATION_ERROR");
    const body = await boundary.readJson(
      request,
      createCvImportRequestSchema,
      4 * 1024,
      {
        validationMessage: (issue) => {
          if (issue.path[0] === "declaredMediaType")
            return "Only PDF, DOC, or DOCX files are supported.";
          if (issue.path[0] === "declaredBytes") {
            if (issue.code === "too_big")
              return "File size must not exceed 5MB.";
            if (issue.code === "too_small")
              return "The uploaded file is empty.";
          }
          return undefined;
        },
      },
    );
    const result = await new CreateCvImportService().execute({
      accountId: current.accountId,
      idempotencyKey: key.data,
      request: body,
    });
    return cvJsonResponse(result.reservation, {
      status: result.replayed ? 200 : 201,
      headers: { Location: result.reservation.contentUrl },
    });
  } catch (error) {
    return cvHttpErrorResponse(
      error,
      request.headers.get("x-request-id") ?? undefined,
    );
  }
}
