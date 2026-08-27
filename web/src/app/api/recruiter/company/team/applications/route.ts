import {
  accountErrorResponse,
  accountJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  TeamApplicationOwnerError,
  TeamApplicationOwnerService,
} from "@/backend/services/company-members/team-application-owner-service";

export async function GET(request: Request) {
  try {
    const account = await requireAccountRequest(request);
    const companyId =
      new URL(request.url).searchParams.get("companyId") ?? undefined;
    return accountJson(
      await new TeamApplicationOwnerService().list(account.userId, companyId),
    );
  } catch (error) {
    if (error instanceof TeamApplicationOwnerError) {
      return accountJson(
        { code: error.code, message: "Owner access is required." },
        { status: error.code === "TEAM_OWNER_FORBIDDEN" ? 403 : 404 },
      );
    }
    return accountErrorResponse(error);
  }
}
