import { serverEnvironment } from "@/backend/env/runtime";
import {
  AccountRequestError,
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  EmailAddressUnavailableError,
  EmailChangeIdempotencyConflictError,
  RecentAuthRequiredError,
  RequestEmailChangeService,
} from "@/backend/services/account/request-email-change";
import {
  emailChangeIdempotencyKeySchema,
  emailChangeRequestSchema,
} from "@/shared/contracts/account/email-change";

function routeError(error: unknown): Response {
  if (error instanceof RecentAuthRequiredError) {
    return accountErrorResponse(
      new AccountRequestError(error.status, {
        code: error.status === 429 ? "RATE_LIMITED" : "RECENT_AUTH_REQUIRED",
        message:
          error.status === 429
            ? "Try again later."
            : "Please confirm your current password to continue.",
        retryAfterSeconds: error.retryAfterSeconds,
      }),
    );
  }
  if (error instanceof EmailAddressUnavailableError) {
    return accountErrorResponse(
      new AccountRequestError(409, {
        code: "EMAIL_ADDRESS_UNAVAILABLE",
        message: "That email address cannot be used.",
      }),
    );
  }
  if (error instanceof EmailChangeIdempotencyConflictError) {
    return accountErrorResponse(
      new AccountRequestError(409, {
        code: "IDEMPOTENCY_CONFLICT",
        message: "Refresh the page before trying a different address.",
      }),
    );
  }
  return accountErrorResponse(error);
}

function networkSource(request: Request) {
  return {
    remoteAddress:
      request.headers.get("x-real-ip") ??
      (serverEnvironment.APP_ENV === "production" ? null : "127.0.0.1"),
    forwardedFor: request.headers.get("x-forwarded-for"),
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAccountRequest(request, { mutation: true });
    const body = await parseBoundedJson(
      request,
      emailChangeRequestSchema,
      8 * 1024,
    );
    const idempotencyKey = emailChangeIdempotencyKeySchema.safeParse(
      request.headers.get("idempotency-key"),
    );
    if (!idempotencyKey.success) {
      throw new AccountRequestError(400, {
        code: "VALIDATION_ERROR",
        message: "Provide a valid request identity and try again.",
        fieldErrors: {
          idempotencyKey: ["Provide a valid Idempotency-Key header."],
        },
      });
    }
    return accountJson(
      await new RequestEmailChangeService().execute(body, {
        headers: request.headers,
        subject: "email-change",
        idempotencyKey: idempotencyKey.data,
        networkSource: networkSource(request),
      }),
      { status: 202 },
    );
  } catch (error) {
    return routeError(error);
  }
}
