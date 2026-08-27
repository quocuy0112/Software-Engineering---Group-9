import {
  accountErrorResponse,
  accountJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  TeamApplicationCommandError,
  TeamApplicationService,
} from "@/backend/services/company-members/team-application-service";

function conflict(error: TeamApplicationCommandError) {
  return accountJson(
    {
      code: error.code,
      message: "This team application is unavailable or already decided.",
    },
    { status: error.code === "TEAM_APPLICATION_UNAVAILABLE" ? 404 : 409 },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const account = await requireAccountRequest(request);
    const { applicationId } = await context.params;
    return accountJson(
      await new TeamApplicationService().getCandidate(
        account.userId,
        applicationId,
      ),
    );
  } catch (error) {
    if (error instanceof TeamApplicationCommandError) return conflict(error);
    return accountErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const account = await requireAccountRequest(request, { mutation: true });
    const { applicationId } = await context.params;
    return accountJson(
      await new TeamApplicationService().withdraw(
        account.userId,
        applicationId,
      ),
    );
  } catch (error) {
    if (error instanceof TeamApplicationCommandError) return conflict(error);
    return accountErrorResponse(error);
  }
}
