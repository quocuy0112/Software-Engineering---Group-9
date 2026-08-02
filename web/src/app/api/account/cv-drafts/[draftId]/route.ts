import {
  CvAccountRequestBoundary,
  cvJsonResponse,
} from "@/backend/security/cv-account-request-boundary";
import { CvDraftComparisonService } from "@/backend/services/cv-import/cv-draft-comparison-service";
import {
  cvHttpErrorResponse,
  CvImportServiceError,
} from "@/backend/services/cv-import/cv-http-errors";
import { cvDraftIdSchema } from "@/shared/contracts/cv-import/common";
import {
  CV_SAVE_DRAFT_REQUEST_MAX_BYTES,
  saveCvDraftRequestSchema,
} from "@/shared/contracts/cv-import/review";

const boundary = new CvAccountRequestBoundary();

async function draftId(params: Promise<{ draftId: string }>) {
  const parsed = cvDraftIdSchema.safeParse((await params).draftId);
  if (!parsed.success) throw new CvImportServiceError("CV_DRAFT_NOT_FOUND");
  return parsed.data;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  try {
    const id = await draftId(params);
    const current = await boundary.authorize(request, {
      resource: { type: "draft", id },
    });
    return cvJsonResponse(
      await new CvDraftComparisonService().get(current.accountId, id),
    );
  } catch (error) {
    return cvHttpErrorResponse(
      error,
      request.headers.get("x-request-id") ?? undefined,
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  try {
    const id = await draftId(params);
    const current = await boundary.authorize(request, {
      mutation: true,
      resource: { type: "draft", id },
    });
    const body = await boundary.readJson(
      request,
      saveCvDraftRequestSchema,
      CV_SAVE_DRAFT_REQUEST_MAX_BYTES,
    );
    return cvJsonResponse(
      await new CvDraftComparisonService().save(current.accountId, id, body),
    );
  } catch (error) {
    return cvHttpErrorResponse(
      error,
      request.headers.get("x-request-id") ?? undefined,
    );
  }
}
