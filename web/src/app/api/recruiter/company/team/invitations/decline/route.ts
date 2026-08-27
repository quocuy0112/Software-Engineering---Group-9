import {
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  CompanyTeamCommandError,
  CompanyTeamService,
} from "@/backend/company-members/company-team-service";
import { teamInvitationReferenceSchema } from "@/shared/contracts/company-members/team";

export async function POST(request: Request) {
  try {
    const account = await requireAccountRequest(request, { mutation: true });
    const input = await parseBoundedJson(
      request,
      teamInvitationReferenceSchema,
      1024,
    );
    const service = new CompanyTeamService();
    if ("token" in input) {
      await service.decline(account.userId, input.token);
    } else {
      await service.declineById(account.userId, input.invitationId);
    }
    return accountJson({ ok: true });
  } catch (error) {
    if (error instanceof CompanyTeamCommandError)
      return accountJson(
        { code: error.code, message: "This invitation is unavailable." },
        { status: 409 },
      );
    return accountErrorResponse(error);
  }
}
