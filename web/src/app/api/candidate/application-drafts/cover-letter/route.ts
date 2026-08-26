import { AccountRequestError } from "@/backend/security/account-request-boundary";
import {
  jobErrorResponse,
  jobJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";
import {
  candidateApplicationError,
  CandidateApplicationError,
} from "@/backend/candidate-applications/candidate-application-errors";
import { ApplicationDraftService } from "@/backend/candidate-applications/application-draft-service";

function errorResponse(error: unknown) {
  return jobErrorResponse(candidateApplicationError(error));
}

export async function POST(request: Request) {
  try {
    const actor = await requireJobActor(request, { mutation: true });
    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("multipart/form-data")
    ) {
      throw new CandidateApplicationError(
        400,
        "APPLICATION_COVER_LETTER_INELIGIBLE",
        "Attach a PDF, DOC, or DOCX cover letter.",
      );
    }
    const form = await request.formData();
    const draftId = form.get("draftId");
    const revision = form.get("expectedRevision");
    const file = form.get("file");
    if (
      typeof draftId !== "string" ||
      !/^\S.{0,127}$/u.test(draftId) ||
      typeof revision !== "string" ||
      !/^\d{1,9}$/u.test(revision) ||
      !(file instanceof File)
    ) {
      throw new AccountRequestError(400, {
        code: "VALIDATION_ERROR",
        message: "Choose a cover letter file.",
      });
    }
    const draft = await new ApplicationDraftService().attachCoverLetter(
      actor,
      draftId,
      Number(revision),
      file,
    );
    return jobJson(draft);
  } catch (error) {
    return errorResponse(error);
  }
}
