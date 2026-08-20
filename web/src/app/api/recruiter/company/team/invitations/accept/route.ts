import {
  accountErrorResponse,
  accountJson,
  parseBoundedJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import { teamAcceptSchema } from "@/shared/contracts/company-members/team";
import { CompanyTeamCommandError, CompanyTeamService } from "@/backend/company-members/company-team-service";
export async function GET(request: Request) {
  try {
    const account = await requireAccountRequest(request);
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const input = teamAcceptSchema.parse({ token });
    return accountJson(await new CompanyTeamService().preview(account.userId, input.token));
  } catch (e) {
    if (e instanceof CompanyTeamCommandError)
      return accountJson({ code: e.code, message: "This invitation is unavailable." }, { status: 409 });
    return accountErrorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    const a = await requireAccountRequest(request, { mutation: true });
    const b = await parseBoundedJson(request, teamAcceptSchema, 1024);
    await new CompanyTeamService().accept(a.userId, b.token);
    return accountJson({ ok: true });
  } catch (e) {
    if (e instanceof CompanyTeamCommandError) return accountJson({ code: e.code, message: "This invitation is unavailable." }, { status: 409 });
    return accountErrorResponse(e);
  }
}
