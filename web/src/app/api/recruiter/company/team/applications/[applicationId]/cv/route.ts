import {
  accountErrorResponse,
  accountJson,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  openTeamApplicationCv,
  TeamApplicationCvError,
} from "@/backend/services/company-members/team-application-cv-service";
import { TeamApplicationService } from "@/backend/services/company-members/team-application-service";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function fileName(value: string) {
  const safe = value
    .replace(/[\\/\r\n]/gu, "_")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .trim()
    .slice(0, 180);
  return safe || "team-application-cv";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const account = await requireAccountRequest(request);
    const { applicationId } = await context.params;
    const result = await openTeamApplicationCv(account.userId, applicationId);
    await new TeamApplicationService().markOwnerViewed(
      account.userId,
      applicationId,
    );
    const iterator = result.stream[Symbol.asyncIterator]();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      },
      cancel() {
        void iterator.return?.();
      },
    });
    return new Response(stream, {
      headers: {
        ...headers,
        "Content-Type": result.application.cvMimeType,
        "Content-Length": String(result.application.cvByteSize),
        "Content-Disposition": `inline; filename="${fileName(result.application.cvFileName)}"`,
      },
    });
  } catch (error) {
    if (error instanceof TeamApplicationCvError) {
      return accountJson(
        { code: error.code, message: "The CV is not available." },
        { status: 404, headers },
      );
    }
    return accountErrorResponse(error);
  }
}
