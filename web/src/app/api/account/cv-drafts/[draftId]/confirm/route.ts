import {
  CvAccountRequestBoundary,
  cvJsonResponse,
} from "@/backend/security/cv-account-request-boundary";
import { ConfirmCvDraftService } from "@/backend/services/cv-import/confirm-cv-draft";
import {
  cvHttpErrorResponse,
  CvImportServiceError,
} from "@/backend/services/cv-import/cv-http-errors";
import {
  cvDraftIdSchema,
  cvIdempotencyKeySchema,
} from "@/shared/contracts/cv-import/common";
import { confirmCvDraftRequestSchema } from "@/shared/contracts/cv-import/review";

const boundary = new CvAccountRequestBoundary();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  try {
    const id = cvDraftIdSchema.safeParse((await params).draftId);
    if (!id.success) throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");
    const key = cvIdempotencyKeySchema.safeParse(
      request.headers.get("idempotency-key"),
    );
    if (!key.success) throw new CvImportServiceError("VALIDATION_ERROR");
    const current = await boundary.authorize(request, {
      mutation: true,
      resource: { type: "draft", id: id.data },
    });
    const body = await boundary.readJson(
      request,
      confirmCvDraftRequestSchema,
      4 * 1024,
    );
    const result = await new ConfirmCvDraftService().execute({
      accountId: current.accountId,
      draftId: id.data,
      idempotencyKey: key.data,
      request: body,
    });
    return cvJsonResponse(result.receipt, {
      status: result.replayed ? 200 : 201,
      headers: {
        Location: `/api/account/cv-imports/${result.receipt.uploadId}`,
      },
    });
  } catch (error) {
    return cvHttpErrorResponse(
      error,
      request.headers.get("x-request-id") ?? undefined,
    );
  }
}
