import { CandidateApplicationTrackingService } from "@/backend/candidate-applications/candidate-application-tracking-service";
import { ApplicationIntakeService } from "@/backend/candidate-applications/application-intake-service";
import { candidateApplicationError } from "@/backend/candidate-applications/candidate-application-errors";
import {
  jobErrorResponse,
  jobJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const actor = await requireJobActor(request, { mutation: true });
    const applicationId = (await context.params).applicationId;
    // Ownership is checked by retry; this read also gives the client an
    // immediately consistent safe projection after the command.
    await new ApplicationIntakeService().retry(actor.userId, applicationId);
    return jobJson(await new CandidateApplicationTrackingService().get(actor, applicationId));
  } catch (error) {
    return jobErrorResponse(candidateApplicationError(error));
  }
}
