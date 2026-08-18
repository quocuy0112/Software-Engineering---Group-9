import { CandidateApplicationTrackingService } from "@/backend/candidate-applications/candidate-application-tracking-service";
import { candidateApplicationError } from "@/backend/candidate-applications/candidate-application-errors";
import {
  jobErrorResponse,
  jobJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";

export async function GET(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const actor = await requireJobActor(request, { mutation: false });
    const result = await new CandidateApplicationTrackingService().get(
      actor,
      (await context.params).applicationId,
    );
    return jobJson(result);
  } catch (error) {
    return jobErrorResponse(candidateApplicationError(error));
  }
}
