import { ShortlistApplicationService } from "@/backend/applications/services/shortlist-application";
import {
  jobErrorResponse,
  jobJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";
import { applicationShortlistOutcomeSchema } from "@/shared/contracts/jobs/applications";

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const actor = await requireJobActor(request);
    const result = await new ShortlistApplicationService().execute({
      userId: actor.userId,
      sessionId: actor.sessionId,
      applicationId: (await context.params).applicationId,
    });
    return jobJson(applicationShortlistOutcomeSchema.parse(result));
  } catch (error) {
    return jobErrorResponse(error);
  }
}
