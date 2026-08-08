import { CandidateApplicationService } from "@/backend/services/jobs/candidate-application-service";
import {
  jobErrorResponse,
  jobJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";
import { candidateApplicationDetailSchema } from "@/shared/contracts/jobs/applications";

export async function GET(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const actor = await requireJobActor(request, { mutation: false });
    const result = await new CandidateApplicationService().detail(
      actor,
      (await context.params).applicationId,
    );
    return jobJson(candidateApplicationDetailSchema.parse(result));
  } catch (error) {
    return jobErrorResponse(error);
  }
}
