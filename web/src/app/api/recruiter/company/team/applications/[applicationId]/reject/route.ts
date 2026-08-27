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
import { teamApplicationRejectSchema } from "@/shared/contracts/company-members/team-applications";

export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const account = await requireAccountRequest(request, { mutation: true });
    const { applicationId } = await context.params;
    const input = await parseBoundedJson(
      request,
      teamApplicationRejectSchema,
      4096,
    );
    return accountJson(
      await new TeamApplicationOwnerService().reject(
        account.userId,
        applicationId,
        input.reason,
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
          message: "The team application could not be rejected.",
        },
        { status },
      );
    }
    return accountErrorResponse(error);
  }
}
