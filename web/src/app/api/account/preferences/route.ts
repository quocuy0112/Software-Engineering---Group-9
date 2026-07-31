import {
  AccountRequestError,
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  AccountPreferencesInvalidError,
  AccountPreferencesService,
  UnsupportedTimezoneError,
} from "@/backend/services/account/account-preferences-service";
import { accountPreferencesMutationSchema } from "@/shared/contracts/account/preferences";

function routeError(error: unknown): Response {
  if (error instanceof UnsupportedTimezoneError) {
    return accountErrorResponse(
      new AccountRequestError(400, {
        code: "ACCOUNT_TIMEZONE_UNSUPPORTED",
        message: "Choose a supported timezone.",
        fieldErrors: { timezone: ["Choose a supported timezone."] },
      }),
    );
  }
  if (error instanceof AccountPreferencesInvalidError) {
    return accountErrorResponse(
      new AccountRequestError(400, {
        code: "VALIDATION_ERROR",
        message: "Review the complete preference set.",
      }),
    );
  }
  if (error instanceof Error && error.message === "ACCOUNT_UNAVAILABLE") {
    return accountErrorResponse(
      new AccountRequestError(403, {
        code: "ACCOUNT_UNAVAILABLE",
        message: "This account cannot perform that action.",
      }),
    );
  }
  return accountErrorResponse(error);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const current = await requireAccountRequest(request);
    return accountJson(
      await new AccountPreferencesService().get(current.userId),
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const current = await requireAccountRequest(request, { mutation: true });
    const body = await parseBoundedJson(
      request,
      accountPreferencesMutationSchema,
      8 * 1024,
    );
    return accountJson(
      await new AccountPreferencesService().update(current.userId, body),
    );
  } catch (error) {
    return routeError(error);
  }
}
