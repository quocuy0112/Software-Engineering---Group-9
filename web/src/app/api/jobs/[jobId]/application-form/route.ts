import { JobApplicationService } from "@/backend/services/jobs/job-application-service";
import {
  jobErrorResponse,
  jobJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const actor = await requireJobActor(request, { mutation: false });
    const result = await new JobApplicationService().form(
      actor,
      (await context.params).jobId,
    );
    return jobJson(result);
  } catch (error) {
    return jobErrorResponse(error);
  }
}
