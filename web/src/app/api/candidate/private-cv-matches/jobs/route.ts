import {
  AccountRequestError,
  requireAccountRequest,
} from "@/backend/security/account-request-boundary";
import { z } from "zod";
import {
  privateMatchJobsQuerySchema,
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
  if (error instanceof z.ZodError) {
    return Response.json(
      { code: "INVALID_REQUEST" },
      { status: 400, headers: noStore },
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
    const params = new URL(request.url).searchParams;
    const query = privateMatchJobsQuerySchema.parse({
      q: params.get("q") ?? "",
      searchBy: params.get("searchBy") ?? undefined,
      limit: params.get("limit") ?? undefined,
    });
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
