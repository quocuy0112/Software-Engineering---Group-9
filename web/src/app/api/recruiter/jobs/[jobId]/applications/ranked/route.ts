import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { rankedListQuerySchema } from "@/shared/contracts/scoring";
import { RankedCandidateListService } from "@/backend/applications/services/ranked-candidate-list";

const noStore = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const current = await requireSession(request.headers);
  if (!current) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Authentication required." }, { status: 401, headers: noStore });
  const jobId = (await context.params).jobId;
  const query = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = rankedListQuerySchema.safeParse(query);
  if (!parsed.success) return NextResponse.json({ code: "INVALID_REQUEST", message: "The ranking filters are invalid." }, { status: 400, headers: noStore });
  try {
    const page = await new RankedCandidateListService().execute({ userId: current.userId, jobId, filters: parsed.data });
    return NextResponse.json(page, { headers: noStore });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_RANKING_CURSOR") return NextResponse.json({ code: "INVALID_REQUEST", message: "The ranking page cursor is invalid. Restart the page." }, { status: 400, headers: noStore });
    return NextResponse.json({ code: "UNAVAILABLE", message: "Applications are not available." }, { status: 404, headers: noStore });
  }
}
