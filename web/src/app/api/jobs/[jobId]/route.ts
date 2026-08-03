import { serverEnvironment } from "@/backend/env/runtime";
import { JobDiscoveryService } from "@/backend/services/jobs/job-discovery-service";
import {
  jobErrorResponse,
  optionalJobActor,
  publicJobJson,
} from "@/backend/security/job-request-boundary";

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const actor = await optionalJobActor(request.headers);
    const { jobId: slug } = await context.params;
    const result = await new JobDiscoveryService().detail(
      slug,
      actor,
      new Date(),
      serverEnvironment.NEXT_PUBLIC_APP_URL,
    );
    return publicJobJson(result, actor);
  } catch (error) {
    return jobErrorResponse(error);
  }
}
