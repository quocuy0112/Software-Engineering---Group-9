import {
  AccountRequestError,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import {
  projectPrivateMatchJob,
  searchEligiblePrivateMatchJobs,
} from "@/backend/private-cv-match/private-cv-match-service";
import { privateMatchJobsResponseSchema } from "@/shared/contracts/private-cv-match";

const noStore = { "Cache-Control": "no-store" };

function errorResponse(error: unknown): Response {
  if (error instanceof AccountRequestError) {
    return Response.json(
      {
        code:
          error.status === 401
            ? "AUTH_REQUIRED"
            : error.status === 403
              ? "FORBIDDEN"
              : "INVALID_REQUEST",
      },
      { status: error.status, headers: noStore },
    );
  }
  return Response.json(
    { code: "INTERNAL_FAILURE" },
    { status: 503, headers: noStore },
  );
}

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAccountRequest(request);
    const query = new URL(request.url).searchParams.get("q") ?? "";
    const jobs = await searchEligiblePrivateMatchJobs(query);
    return Response.json(
      privateMatchJobsResponseSchema.parse({
        items: jobs.map(projectPrivateMatchJob),
      }),
      { headers: noStore },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
