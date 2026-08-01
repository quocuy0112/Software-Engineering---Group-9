import {
  AccountRequestError,
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  ProfileAvatarService,
  ProfileAvatarValidationError,
} from "@/backend/services/profile/profile-avatar-service";
import { profileAvatarMutationSchema } from "@/shared/contracts/account/profile-avatar";

function avatarError(error: unknown) {
  if (error instanceof ProfileAvatarValidationError) {
    return accountErrorResponse(
      new AccountRequestError(400, {
        code: "VALIDATION_ERROR",
        message: "Choose a valid PNG or JPEG photo and try again.",
      }),
    );
  }
  return accountErrorResponse(error);
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const current = await requireAccountRequest(request, { mutation: true });
    const body = await parseBoundedJson(
      request,
      profileAvatarMutationSchema,
      1_150_000,
    );
    return accountJson(
      await new ProfileAvatarService().save(current.userId, body.image),
    );
  } catch (error) {
    return avatarError(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const current = await requireAccountRequest(request, { mutation: true });
    return accountJson(await new ProfileAvatarService().remove(current.userId));
  } catch (error) {
    return avatarError(error);
  }
}
