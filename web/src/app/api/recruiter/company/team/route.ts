import {
  accountErrorResponse,
  accountJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import { CompanyTeamService } from "@/backend/company-members/company-team-service";
import { CompanyTeamAuthorizationError } from "@/backend/company-members/company-team-authorization";
export async function GET(request: Request) {
  try {
    const companyId =
      new URL(request.url).searchParams.get("companyId") ?? undefined;
    return accountJson(
      await new CompanyTeamService().list(
        (await requireAccountRequest(request)).userId,
        companyId,
      ),
    );
  } catch (e) {
    if (e instanceof CompanyTeamAuthorizationError) {
      return accountJson(
        { code: "TEAM_FORBIDDEN", message: "Owner access is required." },
        { status: 403 },
      );
    }
    return accountErrorResponse(e);
  }
}
