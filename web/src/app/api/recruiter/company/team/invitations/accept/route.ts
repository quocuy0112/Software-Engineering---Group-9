import {
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import { teamInvitationReferenceSchema } from "@/shared/contracts/company-members/team";
import {
  CompanyTeamCommandError,
  CompanyTeamService,
} from "@/backend/company-members/company-team-service";

function parseInvitationReference(url: URL) {
  const token = url.searchParams.get("token");
  const invitationId = url.searchParams.get("invitationId");
  return teamInvitationReferenceSchema.parse(
    token && !invitationId
      ? { token }
      : !token && invitationId
        ? { invitationId }
        : {},
  );
}

export async function GET(request: Request) {
  try {
    const account = await requireAccountRequest(request);
    const input = parseInvitationReference(new URL(request.url));
    const service = new CompanyTeamService();
    return accountJson(
      "token" in input
        ? await service.preview(account.userId, input.token)
        : await service.previewById(account.userId, input.invitationId),
    );
  } catch (e) {
    if (e instanceof CompanyTeamCommandError)
      return accountJson(
        { code: e.code, message: "This invitation is unavailable." },
        { status: 409 },
      );
    return accountErrorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    const a = await requireAccountRequest(request, { mutation: true });
    const input = await parseBoundedJson(
      request,
      teamInvitationReferenceSchema,
      1024,
    );
    const service = new CompanyTeamService();
    if ("token" in input) {
      await service.accept(a.userId, input.token);
    } else {
      await service.acceptById(a.userId, input.invitationId);
    }
    return accountJson({ ok: true });
  } catch (e) {
    if (e instanceof CompanyTeamCommandError)
      return accountJson(
        { code: e.code, message: "This invitation is unavailable." },
        { status: 409 },
      );
    return accountErrorResponse(e);
  }
}
