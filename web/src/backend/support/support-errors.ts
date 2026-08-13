export type SupportErrorCode =
  | "AUTH_REQUIRED"
  | "CASE_UNAVAILABLE"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "ACTIVE_CASE_LIMIT"
  | "ASSIGNMENT_REQUIRED"
  | "INVALID_STATE"
  | "STALE_CONFLICT"
  | "PERSISTENCE_UNAVAILABLE";

export class SupportError extends Error {
  constructor(
    public readonly code: SupportErrorCode,
    public readonly status: number,
    public readonly retryable = false,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(code);
  }
}
