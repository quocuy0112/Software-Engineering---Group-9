import {
  accountErrorResponse,
  accountJson,
  AccountRequestError,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  prepareTeamApplicationCv,
  TeamApplicationCvError,
} from "@/backend/services/company-members/team-application-cv-service";
import {
  TeamApplicationCommandError,
  TeamApplicationService,
} from "@/backend/services/company-members/team-application-service";
import { teamApplicationSubmitSchema } from "@/shared/contracts/company-members/team-applications";

function commandResponse(error: TeamApplicationCommandError) {
  const messages: Record<string, string> = {
    TEAM_COMPANY_UNAVAILABLE: "This company is not available.",
    TEAM_OPPORTUNITY_CLOSED: "This team opportunity is no longer open.",
    TEAM_MEMBER_EXISTS: "You already have access to this company.",
    TEAM_APPLICATION_UNAVAILABLE: "This application is unavailable.",
    TEAM_APPLICATION_CONFLICT: "This application has already changed.",
  };
  return accountJson(
    {
      code: error.code,
      message: messages[error.code] ?? "Unable to submit the application.",
    },
    { status: error.code === "TEAM_APPLICATION_UNAVAILABLE" ? 404 : 409 },
  );
}

function cvResponse(error: TeamApplicationCvError) {
  const messages: Record<string, string> = {
    TEAM_CV_FILE_REQUIRED: "Attach a PDF or DOCX CV.",
    TEAM_CV_FILE_TYPE_INVALID: "Only PDF and DOCX CV files are supported.",
    TEAM_CV_FILE_INVALID: "The CV is invalid or exceeds the 5MB limit.",
    TEAM_CV_UNAVAILABLE: "The CV is unavailable.",
  };
  return accountJson(
    {
      code: error.code,
      message: messages[error.code] ?? "The CV could not be processed.",
    },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  try {
    const account = await requireAccountRequest(request);
    return accountJson(
      await new TeamApplicationService().listCandidate(account.userId),
    );
  } catch (error) {
    return accountErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let prepared: Awaited<ReturnType<typeof prepareTeamApplicationCv>> | null =
    null;
  try {
    const account = await requireAccountRequest(request, { mutation: true });
    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("multipart/form-data")
    ) {
      throw new AccountRequestError(400, {
        code: "INVALID_REQUEST",
        message: "Attach a company, role, and CV.",
      });
    }
    const form = await request.formData();
    const fields = teamApplicationSubmitSchema.safeParse({
      companyId: form.get("companyId"),
      role: form.get("role"),
    });
    if (!fields.success) {
      throw new AccountRequestError(400, {
        code: "VALIDATION_ERROR",
        message: "Choose a supported team role and company.",
      });
    }
    const file = form.get("cv");
    prepared = await prepareTeamApplicationCv(file as File);
    const result = await new TeamApplicationService().submit(
      account.userId,
      fields.data.companyId,
      fields.data.role,
      prepared,
    );
    prepared = null;
    return accountJson(result.application, {
      status: result.created ? 201 : 409,
    });
  } catch (error) {
    if (prepared) await prepared.cleanup().catch(() => undefined);
    if (error instanceof TeamApplicationCommandError)
      return commandResponse(error);
    if (error instanceof TeamApplicationCvError) return cvResponse(error);
    return accountErrorResponse(error);
  }
}
