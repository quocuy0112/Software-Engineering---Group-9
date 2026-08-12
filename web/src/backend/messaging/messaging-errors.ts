export const messagingErrorCodes = [
  "AUTH_REQUIRED",
  "AUTHORITY_CHANGED",
  "CONVERSATION_UNAVAILABLE",
  "BLOCKED",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "CONFLICT",
  "PERSISTENCE_UNAVAILABLE",
] as const;

export type MessagingErrorCode = (typeof messagingErrorCodes)[number];

export class MessagingError extends Error {
  constructor(
    public readonly code: MessagingErrorCode,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 503,
    public readonly retryable = false,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(code);
    this.name = "MessagingError";
  }
}

export function unavailableConversation(): MessagingError {
  return new MessagingError("CONVERSATION_UNAVAILABLE", 404);
}
