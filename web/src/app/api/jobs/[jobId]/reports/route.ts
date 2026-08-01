import { JobReportService } from "@/backend/services/jobs/job-report-service";
import { jobReportInputSchema } from "@/shared/contracts/jobs/actions";
import {
  jobErrorResponse,
  jobJson,
  parseBoundedJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const actor = await requireJobActor(request);
    const command = await parseBoundedJson(
      request,
      jobReportInputSchema,
      8 * 1024,
    );
    const result = await new JobReportService().submit(
      actor,
      (await context.params).jobId,
      command,
    );
    return jobJson(result.outcome, { status: result.created ? 201 : 200 });
  } catch (error) {
    return jobErrorResponse(error);
  }
}
