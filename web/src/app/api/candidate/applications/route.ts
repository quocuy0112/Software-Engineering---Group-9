import { z } from "zod";
import { CandidateApplicationService } from "@/backend/services/jobs/candidate-application-service";
import {
  jobErrorResponse,
  jobJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";
import {
  applicationStageGroupSchema,
  applicationStageSchema,
  candidateApplicationListResponseSchema,
} from "@/shared/contracts/jobs/applications";
import { JobServiceError } from "@/backend/services/jobs/job-types";

const querySchema = z
  .object({
    stage: applicationStageSchema.optional(),
    group: applicationStageGroupSchema.optional(),
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const actor = await requireJobActor(request, { mutation: false });
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );
    if (!parsed.success) {
      throw new JobServiceError(400, {
        code: "VALIDATION_ERROR",
        message: "Choose valid application filters.",
      });
    }
    const result = await new CandidateApplicationService().list(
      actor,
      parsed.data,
    );
    return jobJson(candidateApplicationListResponseSchema.parse(result));
  } catch (error) {
    return jobErrorResponse(error);
  }
}
