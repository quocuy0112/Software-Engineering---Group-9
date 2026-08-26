import { createJobPostReviewServices } from "@/backend/jobs/review/job-post-review-service-factory";
import { JobPostReviewError } from "@/backend/jobs/review/job-post-review-errors";
import {
  jobErrorResponse,
  jobJson,
  parseBoundedJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";
import { recruiterReviewProjectionSchema } from "@/shared/contracts/admin/job-post-review";
import { submitJobReviewCommandSchema } from "@/shared/contracts/recruiter-job-posting";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const actor = await requireJobActor(request, { mutation: true });
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128)
      return jobJson(
        {
          code: "JOB_POST_REVIEW_VALIDATION",
          message: "A valid idempotency key is required.",
        },
        { status: 422 },
      );
    const command = await parseBoundedJson(
      request,
      submitJobReviewCommandSchema,
      768 * 1024,
    );
    const { jobId } = await context.params;
    if (!jobId || jobId.length > 128)
      return jobJson(
        { code: "JOB_POST_REVIEW_UNAVAILABLE", message: "Review unavailable." },
        { status: 404 },
      );
    const result = await createJobPostReviewServices().submissions.submit({
      actorUserId: actor.userId,
      actorSessionId: actor.sessionId,
      jobId,
      expectedWorkingUpdatedAt: command.expectedWorkingUpdatedAt,
      expectedCatalogueUpdatedAt: command.expectedCatalogueUpdatedAt,
      idempotencyKey,
      job: command.job,
    });
    return jobJson(recruiterReviewProjectionSchema.parse(result), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof JobPostReviewError) {
      const status =
        error.code === "JOB_POST_REVIEW_UNAVAILABLE"
          ? 404
          : error.code === "JOB_POST_REVIEW_CONFLICT"
            ? 409
            : 422;
      return jobJson(
        {
          code: error.code,
          message: error.message,
          ...(error.currentVersion
            ? { currentVersion: error.currentVersion }
            : {}),
        },
        { status },
      );
    }
    return jobErrorResponse(error);
  }
}
