import { accountErrorResponse, accountJson, requireAccountRequest } from "@/backend/security/account-request-boundary";
import { CompanyTeamAuthorizationError } from "@/backend/company-members/company-team-authorization";
import { CompanyTeamCommandError, CompanyTeamService } from "@/backend/company-members/company-team-service";

export async function POST(request: Request, context: { params: Promise<{ invitationId: string }> }) {
  try {
    const actor = await requireAccountRequest(request, { mutation: true });
    await new CompanyTeamService().revoke(actor.userId, (await context.params).invitationId);
    return accountJson({ ok: true });
  } catch (error) {
    if (error instanceof CompanyTeamAuthorizationError) return accountJson({ code: "TEAM_FORBIDDEN", message: "Owner access is required." }, { status: 403 });
    if (error instanceof CompanyTeamCommandError) return accountJson({ code: error.code, message: "This invitation is unavailable." }, { status: 409 });
    return accountErrorResponse(error);
  }
}
