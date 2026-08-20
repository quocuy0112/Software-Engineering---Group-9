import { MarkApplicationViewedService } from "@/backend/applications/services/mark-application-viewed";
import {
  jobErrorResponse,
  jobJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";
import { applicationViewedOutcomeSchema } from "@/shared/contracts/jobs/applications";

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const actor = await requireJobActor(request);
    const result = await new MarkApplicationViewedService().execute({
      userId: actor.userId,
      sessionId: actor.sessionId,
      applicationId: (await context.params).applicationId,
    });
    return jobJson(applicationViewedOutcomeSchema.parse(result));
  } catch (error) {
    return jobErrorResponse(error);
  }
}
