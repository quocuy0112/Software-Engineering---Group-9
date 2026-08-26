import {
  jobErrorResponse,
  jobJson,
  requireJobActor,
} from "@/backend/security/job-request-boundary";
import { withdrawRecruiterJobReview } from "@/backend/services/jobs/recruiter-job-posting-data";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const actor = await requireJobActor(request, { mutation: true });
    const { jobId } = await context.params;
    if (!jobId || jobId.length > 128) {
      return jobJson({ message: "Job posting not found." }, { status: 404 });
    }
    const industryCode = new URL(request.url).searchParams.get("industryCode");
    if (!industryCode || industryCode.length > 16) {
      return jobJson(
        { message: "A valid industry code is required." },
        { status: 422 },
      );
    }
    const job = await withdrawRecruiterJobReview(
      actor.userId,
      actor.sessionId,
      jobId,
      industryCode,
    );
    return jobJson(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Job posting not found.") {
      return jobJson({ message }, { status: 404 });
    }
    if (
      message ===
        "This job posting cannot be withdrawn in its current status." ||
      message === "JOB_POST_REVIEW_CONFLICT"
    ) {
      return jobJson(
        {
          message: "This job is no longer pending review.",
        },
        { status: 409 },
      );
    }
    if (message === "JOB_POST_REVIEW_UNAVAILABLE") {
      return jobJson({ message: "Review unavailable." }, { status: 404 });
    }
    return jobErrorResponse(error);
  }
}
