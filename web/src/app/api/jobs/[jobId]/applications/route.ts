import { JobApplicationService } from "@/backend/services/jobs/job-application-service";
import { applicationSubmissionSchema } from "@/shared/contracts/jobs/actions";
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
      applicationSubmissionSchema,
      64 * 1024,
    );
    const result = await new JobApplicationService().submit(
      actor,
      (await context.params).jobId,
      request.headers.get("idempotency-key") ?? "",
      command,
    );
    return jobJson(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return jobErrorResponse(error);
  }
}
