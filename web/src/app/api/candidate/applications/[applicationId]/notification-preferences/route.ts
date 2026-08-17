import { candidateApplicationError } from "@/backend/candidate-applications/candidate-application-errors";
import { CandidateApplicationTrackingService } from "@/backend/candidate-applications/candidate-application-tracking-service";
import {
  jobErrorResponse,
  jobJson,
  parseBoundedJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";
import { notificationPreferenceUpdateSchema } from "@/shared/contracts/candidate-applications";

async function update(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const actor = await requireJobActor(request, { mutation: true });
    const body = await parseBoundedJson(
      request,
      notificationPreferenceUpdateSchema,
      8 * 1024,
    );
    const result = await new CandidateApplicationTrackingService().updatePreference(
      actor,
      (await context.params).applicationId,
      body,
    );
    return jobJson(result);
  } catch (error) {
    return jobErrorResponse(candidateApplicationError(error));
  }
}

export const PATCH = update;
export const PUT = update;
