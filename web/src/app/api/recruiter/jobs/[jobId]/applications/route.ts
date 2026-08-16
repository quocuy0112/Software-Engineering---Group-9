import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { applicationListQuerySchema } from "@/shared/contracts/applications";
import { ListSubmittedCandidatesService } from "@/backend/applications/services/list-submitted-candidates";

const noStore = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const current = await requireSession(request.headers);
  if (!current) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "Authentication required." },
      { status: 401, headers: noStore },
    );
  }
  const jobId = (await context.params).jobId;
  const params = new URL(request.url).searchParams;
  const parsed = applicationListQuerySchema.safeParse({
    cursor: params.get("cursor") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "The application page request is invalid." },
      { status: 400, headers: noStore },
    );
  }
  try {
    const page = await new ListSubmittedCandidatesService().execute({ userId: current.userId, jobId, ...parsed.data });
    return NextResponse.json(page, { headers: noStore });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") {
      return NextResponse.json(
        { code: "INVALID_REQUEST", message: "The application page cursor is invalid." },
        { status: 400, headers: noStore },
      );
    }
    return NextResponse.json(
      { code: "UNAVAILABLE", message: "Applications are not available." },
      { status: 404, headers: noStore },
    );
  }
}
