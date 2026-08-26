import {
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import { CompanyTeamAuthorizationError } from "@/backend/company-members/company-team-authorization";
import {
  CompanyTeamCommandError,
  CompanyTeamService,
} from "@/backend/company-members/company-team-service";
import { teamMembershipCommandSchema } from "@/shared/contracts/company-members/team";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ membershipId: string }> },
) {
  try {
    const actor = await requireAccountRequest(request, { mutation: true });
    const companyId =
      new URL(request.url).searchParams.get("companyId") ?? undefined;
    const command = await parseBoundedJson(
      request,
      teamMembershipCommandSchema,
      1024,
    );
    await new CompanyTeamService().change(
      actor.userId,
      (await context.params).membershipId,
      command.action,
      command.role,
      companyId,
    );
    return accountJson({ ok: true });
  } catch (error) {
    if (error instanceof CompanyTeamAuthorizationError)
      return accountJson(
        { code: "TEAM_FORBIDDEN", message: "Owner access is required." },
        { status: 403 },
      );
    if (error instanceof CompanyTeamCommandError)
      return accountJson(
        { code: error.code, message: "This member cannot be updated." },
        { status: 409 },
      );
    return accountErrorResponse(error);
  }
}
