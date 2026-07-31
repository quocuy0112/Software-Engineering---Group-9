import { serverEnvironment } from "@/backend/env/runtime";
import {
  AccountRequestError,
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
} from "@/backend/security/account-request-boundary";
import { validateSameOrigin } from "@/backend/security/csrf/csrf";
import {
  EmailChangeProofInvalidError,
  EmailChangeVerificationUnavailableError,
  VerifyEmailChangeService,
} from "@/backend/services/account/verify-email-change";
import { emailChangeProofSchema } from "@/shared/contracts/account/email-change";

function routeError(error: unknown): Response {
  if (error instanceof EmailChangeProofInvalidError) {
    return accountErrorResponse(
      new AccountRequestError(400, {
        code: "EMAIL_CHANGE_PROOF_INVALID",
        message: "This verification link cannot be used.",
      }),
    );
  }
  if (error instanceof EmailChangeVerificationUnavailableError) {
    return accountErrorResponse(
      new AccountRequestError(409, {
        code: "EMAIL_ADDRESS_UNAVAILABLE",
        message: "This verification link cannot be used.",
      }),
    );
  }
  return accountErrorResponse(error);
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL)) {
      throw new AccountRequestError(403, {
        code: "REQUEST_FORBIDDEN",
        message: "Open the verification page and try again.",
      });
    }
    const body = await parseBoundedJson(
      request,
      emailChangeProofSchema,
      4 * 1024,
    );
    return accountJson(await new VerifyEmailChangeService().execute(body));
  } catch (error) {
    return routeError(error);
  }
}
