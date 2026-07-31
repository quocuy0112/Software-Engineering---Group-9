import {
  AccountRequestError,
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import { ProfileValidationError } from "@/backend/services/profile/profile-validation";
import { GetProfileAggregateService } from "@/backend/services/profile/get-profile-aggregate";
import { SaveProfileSectionService } from "@/backend/services/profile/save-profile-section";
import { profileSectionMutationSchema } from "@/shared/contracts/account/profile";

function profileRouteError(error: unknown): Response {
  if (error instanceof ProfileValidationError) {
    return accountErrorResponse(
      new AccountRequestError(400, {
        code: "VALIDATION_ERROR",
        message: "Review the highlighted fields.",
        fieldErrors: { [error.field]: ["Enter a valid value."] },
      }),
    );
  }
  if (
    error instanceof Error &&
    (error.message.startsWith("PROFILE_VALIDATION_ERROR") ||
      error.message === "PROFILE_ITEM_NOT_OWNED")
  ) {
    return accountErrorResponse(
      new AccountRequestError(400, {
        code:
          error.message === "PROFILE_ITEM_NOT_OWNED"
            ? "PROFILE_ITEM_NOT_OWNED"
            : "VALIDATION_ERROR",
        message:
          error.message === "PROFILE_ITEM_NOT_OWNED"
            ? "One or more profile items could not be updated."
            : "Review the highlighted fields.",
      }),
    );
  }
  return accountErrorResponse(error);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const current = await requireAccountRequest(request);
    return accountJson(
      await new GetProfileAggregateService().execute(current.userId),
    );
  } catch (error) {
    return profileRouteError(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const current = await requireAccountRequest(request, { mutation: true });
    const body = await parseBoundedJson(
      request,
      profileSectionMutationSchema,
      128 * 1024,
    );
    return accountJson(
      await new SaveProfileSectionService().execute(current.userId, body),
    );
  } catch (error) {
    return profileRouteError(error);
  }
}
