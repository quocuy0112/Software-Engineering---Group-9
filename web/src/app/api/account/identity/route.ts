import {
  AccountRequestError,
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import { PlainTextNormalizationError } from "@/backend/security/plain-text/plain-text-normalizer";
import { AccountIdentityService } from "@/backend/services/account/account-identity-service";
import { accountNameMutationSchema } from "@/shared/contracts/account/identity";

function identityError(error: unknown): Response {
  if (error instanceof PlainTextNormalizationError) {
    return accountErrorResponse(
      new AccountRequestError(400, {
        code: "VALIDATION_ERROR",
        message: "Review the highlighted fields.",
        fieldErrors: { name: ["Enter a valid full name."] },
      }),
    );
  }
  if (
    error instanceof Error &&
    error.message === "ACCOUNT_IDENTITY_UNAVAILABLE"
  ) {
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
    return accountJson(await new AccountIdentityService().get(current.userId));
  } catch (error) {
    return identityError(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const current = await requireAccountRequest(request, { mutation: true });
    const body = await parseBoundedJson(
      request,
      accountNameMutationSchema,
      4 * 1024,
    );
    return accountJson(
      await new AccountIdentityService().updateName(current.userId, body),
    );
  } catch (error) {
    return identityError(error);
  }
}
