import { JobServiceError } from "@/backend/services/jobs/job-types";
import { z } from "zod";

export class CandidateApplicationError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 503,
    readonly code: string,
    message: string,
  ) {
    super(code);
    this.name = "CandidateApplicationError";
    this.message = message;
  }
}

export function candidateApplicationError(
  error: unknown,
): JobServiceError | unknown {
  if (error instanceof CandidateApplicationError) {
    return new JobServiceError(error.status, {
      code: error.code,
      message: error.message,
    });
  }
  if (error instanceof z.ZodError) {
    return new JobServiceError(400, {
      code: "VALIDATION_ERROR",
      message: "Review the application fields and try again.",
    });
  }
  return error;
}

export function isCandidateApplicationConflict(error: unknown) {
  return (
    error instanceof CandidateApplicationError && error.status === 409
  );
}
