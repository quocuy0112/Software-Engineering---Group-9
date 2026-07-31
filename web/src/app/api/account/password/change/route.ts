import { randomUUID } from "node:crypto";
import { serverEnvironment } from "@/backend/env/runtime";
import {
  AccountRequestError,
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  ChangePasswordService,
  CurrentPasswordInvalidError,
  PasswordChangeIdempotencyConflictError,
  PasswordChangeIncompleteError,
  PasswordChangeLockedError,
  PasswordChangeSessionMismatchError,
  PasswordChangeValidationError,
} from "@/backend/services/account/change-password";
import {
  passwordChangeIdempotencyKeySchema,
  passwordChangeRequestSchema,
} from "@/shared/contracts/account/password-change";

function networkSource(request: Request) {
  return {
    remoteAddress:
      request.headers.get("x-real-ip") ??
      (serverEnvironment.APP_ENV === "production" ? null : "127.0.0.1"),
    forwardedFor: request.headers.get("x-forwarded-for"),
  };
}

function routeError(error: unknown): Response {
  if (error instanceof PasswordChangeValidationError) {
    return accountErrorResponse(
      new AccountRequestError(400, {
        code: error.code,
        message: error.safeMessage,
        fieldErrors: {
          newPassword: [error.safeMessage],
        },
      }),
    );
  }
  if (error instanceof CurrentPasswordInvalidError) {
    return accountErrorResponse(
      new AccountRequestError(401, {
        code: "CURRENT_PASSWORD_INVALID",
        message: "The current password is incorrect.",
        fieldErrors: {
          currentPassword: ["Enter the current password for this account."],
        },
      }),
    );
  }
  if (error instanceof PasswordChangeLockedError) {
    return accountErrorResponse(
      new AccountRequestError(429, {
        code: "PASSWORD_CHANGE_LOCKED",
        message:
          "Too many incorrect current-password attempts. Try again later.",
        retryAfterSeconds: error.retryAfterSeconds,
      }),
    );
  }
  if (error instanceof PasswordChangeIdempotencyConflictError) {
    return accountErrorResponse(
      new AccountRequestError(409, {
        code: "IDEMPOTENCY_CONFLICT",
        message:
          "Refresh the page before starting a different password change.",
      }),
    );
  }
  if (error instanceof PasswordChangeSessionMismatchError) {
    return accountErrorResponse(
      new AccountRequestError(403, {
        code: "REQUEST_FORBIDDEN",
        message: "Refresh the page and try again from the initiating session.",
      }),
    );
  }
  if (error instanceof PasswordChangeIncompleteError) {
    return accountErrorResponse(
      new AccountRequestError(503, {
        code: "PASSWORD_CHANGE_INCOMPLETE",
        message: "The password change could not be completed. Try again.",
      }),
    );
  }
  return accountErrorResponse(error);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const current = await requireAccountRequest(request, { mutation: true });
    const body = await parseBoundedJson(
      request,
      passwordChangeRequestSchema,
      4 * 1024,
    );
    const key = passwordChangeIdempotencyKeySchema.safeParse(
      request.headers.get("idempotency-key"),
    );
    if (!key.success) {
      throw new AccountRequestError(400, {
        code: "VALIDATION_ERROR",
        message: "Provide a valid request identity and try again.",
        fieldErrors: {
          idempotencyKey: ["Provide a valid Idempotency-Key header."],
        },
      });
    }
    return accountJson(
      await new ChangePasswordService().execute(body, {
        userId: current.userId,
        sessionId: current.sessionId,
        idempotencyKey: key.data,
        headers: request.headers,
        correlationId: randomUUID(),
        networkSource: networkSource(request),
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
