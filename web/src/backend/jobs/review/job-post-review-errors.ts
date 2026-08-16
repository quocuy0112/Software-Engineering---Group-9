export type JobPostReviewErrorCode =
  | "JOB_POST_REVIEW_VALIDATION"
  | "JOB_POST_REVIEW_FORBIDDEN"
  | "JOB_POST_REVIEW_UNAVAILABLE"
  | "JOB_POST_REVIEW_CONFLICT"
  | "JOB_POST_REVIEW_INTEGRITY"
  | "JOB_POST_REVIEW_ASSIGNMENT";

export class JobPostReviewError extends Error {
  constructor(
    readonly code: JobPostReviewErrorCode,
    message = "The requested job review operation could not be completed.",
    readonly currentVersion?: number,
  ) {
    super(message);
    this.name = "JobPostReviewError";
  }
}

export const jobPostReviewUnavailable = () =>
  new JobPostReviewError("JOB_POST_REVIEW_UNAVAILABLE", "Review unavailable.");
