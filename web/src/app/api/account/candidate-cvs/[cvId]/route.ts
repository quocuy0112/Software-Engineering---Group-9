import {
  AccountRequestError,
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  archiveCandidateCv,
  CandidateCvNotFoundError,
  renameCandidateCv,
} from "@/backend/services/profile/candidate-cv-library";
import {
  candidateCvDeleteOutcomeSchema,
  candidateCvIdSchema,
  candidateCvRenameRequestSchema,
} from "@/shared/contracts/cv-import/candidate-cv";

type RouteContext = { params: Promise<{ cvId: string }> };

function notFoundResponse() {
  return accountErrorResponse(
    new AccountRequestError(404, {
      code: "CANDIDATE_CV_NOT_FOUND",
      message: "The selected CV was not found.",
    }),
  );
}

async function idFrom(context: RouteContext) {
  const parsed = candidateCvIdSchema.safeParse((await context.params).cvId);
  if (!parsed.success)
    throw new AccountRequestError(400, {
      code: "VALIDATION_ERROR",
      message: "Review the selected CV.",
    });
  return parsed.data;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const current = await requireAccountRequest(request, { mutation: true });
    const cvId = await idFrom(context);
    const body = await parseBoundedJson(
      request,
      candidateCvRenameRequestSchema,
      4 * 1024,
    );
    return accountJson(await renameCandidateCv(current.userId, cvId, body));
  } catch (error) {
    if (error instanceof CandidateCvNotFoundError) return notFoundResponse();
    return accountErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const current = await requireAccountRequest(request, { mutation: true });
    const cvId = await idFrom(context);
    const result = await archiveCandidateCv(current.userId, cvId);
    return accountJson(candidateCvDeleteOutcomeSchema.parse(result));
  } catch (error) {
    if (error instanceof CandidateCvNotFoundError) return notFoundResponse();
    return accountErrorResponse(error);
  }
}
