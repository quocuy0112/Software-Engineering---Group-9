import { SavedJobService } from "@/backend/services/jobs/saved-job-service";
import {
  jobErrorResponse,
  jobJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";

type RouteContext = { params: Promise<{ jobId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const actor = await requireJobActor(request);
    const result = await new SavedJobService().save(
      actor,
      (await context.params).jobId,
    );
    return jobJson(result);
  } catch (error) {
    return jobErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const actor = await requireJobActor(request);
    const result = await new SavedJobService().remove(
      actor,
      (await context.params).jobId,
    );
    return jobJson(result);
  } catch (error) {
    return jobErrorResponse(error);
  }
}
