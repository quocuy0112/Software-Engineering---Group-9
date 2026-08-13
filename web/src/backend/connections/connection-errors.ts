export type ConnectionErrorCode =
  | "AUTH_REQUIRED"
  | "RESOURCE_UNAVAILABLE"
  | "VALIDATION_ERROR"
  | "STATE_CONFLICT"
  | "VERSION_CONFLICT"
  | "RATE_LIMITED"
  | "QUOTA_REACHED"
  | "COOLDOWN_ACTIVE"
  | "BLOCKED"
  | "TEMPORARILY_UNAVAILABLE";

export class ConnectionError extends Error {
  constructor(
    public readonly code: ConnectionErrorCode,
    public readonly status: number,
    public readonly retryAfterSeconds?: number,
    public readonly currentVersion?: number,
  ) {
    super(code);
  }
}
