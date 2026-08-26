import { z } from "zod";
import {
  jobErrorResponse,
  jobJson,
  parseBoundedJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";
import {
  candidateApplicationError,
  CandidateApplicationError,
} from "@/backend/candidate-applications/candidate-application-errors";
import { ApplicationDraftService } from "@/backend/candidate-applications/application-draft-service";
import { saveApplicationDraftCommandSchema } from "@/shared/contracts/candidate-applications";

const querySchema = z.object({ jobId: z.string().trim().min(1).max(128) }).strict();

function errorResponse(error: unknown) {
  return jobErrorResponse(candidateApplicationError(error));
}

export async function GET(request: Request) {
  try {
    const actor = await requireJobActor(request, { mutation: false });
    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    if (!parsed.success) {
      throw new CandidateApplicationError(
        400,
        "APPLICATION_DRAFT_REQUEST_INVALID",
        "Choose a job before loading the application draft.",
      );
    }
    const draft = await new ApplicationDraftService().get(
      actor,
      parsed.data.jobId,
    );
    return jobJson({ draft });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireJobActor(request, { mutation: true });
    const command = await parseBoundedJson(
      request,
      saveApplicationDraftCommandSchema,
      64 * 1024,
    );
    const draft = await new ApplicationDraftService().save(actor, command);
    return jobJson(draft);
  } catch (error) {
    return errorResponse(error);
  }
}
