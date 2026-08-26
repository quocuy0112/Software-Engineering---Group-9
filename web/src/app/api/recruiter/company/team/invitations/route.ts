import {
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import { teamInviteSchema } from "@/shared/contracts/company-members/team";
import {
  CompanyTeamCommandError,
  CompanyTeamService,
} from "@/backend/company-members/company-team-service";
import { CompanyTeamAuthorizationError } from "@/backend/company-members/company-team-authorization";
export async function POST(request: Request) {
  try {
    const a = await requireAccountRequest(request, { mutation: true });
    const companyId =
      new URL(request.url).searchParams.get("companyId") ?? undefined;
    const b = await parseBoundedJson(request, teamInviteSchema, 2048);
    const result = await new CompanyTeamService().invite(
      a.userId,
      b.email,
      b.role,
      companyId,
    );
    return accountJson(result, { status: 201 });
  } catch (e) {
    if (e instanceof CompanyTeamAuthorizationError)
      return accountJson(
        { code: "TEAM_FORBIDDEN", message: "Owner access is required." },
        { status: 403 },
      );
    if (e instanceof CompanyTeamCommandError)
      return accountJson(
        { code: e.code, message: "The invitation could not be created." },
        { status: 409 },
      );
    return accountErrorResponse(e);
  }
}
