import {
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  TeamApplicationOwnerError,
  TeamApplicationOwnerService,
} from "@/backend/services/company-members/team-application-owner-service";
import { teamApplicationAcceptSchema } from "@/shared/contracts/company-members/team-applications";

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const account = await requireAccountRequest(request, { mutation: true });
    const { applicationId } = await context.params;
    const input = await parseBoundedJson(
      request,
      teamApplicationAcceptSchema,
      2048,
    );
    return accountJson(
      await new TeamApplicationOwnerService().accept(
        account.userId,
        applicationId,
        input.role,
      ),
    );
  } catch (error) {
    if (error instanceof TeamApplicationOwnerError) {
      const status =
        error.code === "TEAM_OWNER_FORBIDDEN"
          ? 403
          : error.code === "TEAM_APPLICATION_UNAVAILABLE"
            ? 404
            : 409;
      return accountJson(
        {
          code: error.code,
          message: "The team application could not be accepted.",
        },
        { status },
      );
    }
    return accountErrorResponse(error);
  }
}
