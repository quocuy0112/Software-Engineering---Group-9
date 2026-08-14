import "server-only";
import { accountErrorResponse, accountJson } from "@/backend/security/account-request-boundary";

export class NotificationError extends Error {
  constructor(
    readonly code: "INVALID_REQUEST" | "NOTIFICATION_UNAVAILABLE",
    readonly status: 400 | 404,
  ) {
    super(code);
  }
}

export function notificationRouteError(error: unknown) {
  if (error instanceof NotificationError) {
    return accountJson({ code: error.code }, { status: error.status });
  }
  return accountErrorResponse(error);
}
