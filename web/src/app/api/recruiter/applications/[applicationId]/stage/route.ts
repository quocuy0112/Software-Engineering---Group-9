import { ApplicationStageService } from "@/backend/services/jobs/application-stage-service";
import {
  jobErrorResponse,
  jobJson,
  parseBoundedJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";
import {
  applicationStageTransitionOutcomeSchema,
  applicationStageTransitionSchema,
} from "@/shared/contracts/jobs/applications";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const actor = await requireJobActor(request);
    const command = await parseBoundedJson(
      request,
      applicationStageTransitionSchema,
      8 * 1024,
    );
    const result = await new ApplicationStageService().transition(
      actor,
      (await context.params).applicationId,
      command,
    );
    return jobJson(applicationStageTransitionOutcomeSchema.parse(result));
  } catch (error) {
    return jobErrorResponse(error);
  }
}
