import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { ScoringDetailService } from "@/backend/scoring/services/scoring-detail-service";

const noStore = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function isSchemaMismatch(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2022"
  );
}

export async function GET(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  const current = await requireSession(request.headers);
  if (!current) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Authentication required." }, { status: 401, headers: noStore });
  try {
    return NextResponse.json(await new ScoringDetailService().get(current.userId, (await context.params).applicationId), { headers: noStore });
  } catch (error) {
    if (isSchemaMismatch(error)) {
      return NextResponse.json({ code: "DATABASE_SCHEMA_OUT_OF_DATE", message: "The scoring database schema is out of date. Apply the pending Prisma migrations and restart the application." }, { status: 503, headers: noStore });
    }
    if (error instanceof Error && error.message === "APPLICATION_UNAVAILABLE") {
      return NextResponse.json({ code: "UNAVAILABLE", message: "The application is not available." }, { status: 404, headers: noStore });
    }
    console.error("[scoring-detail] failed to load application scoring", error);
    return NextResponse.json({ code: "SCORING_DETAIL_UNAVAILABLE", message: "The scoring details could not be loaded right now. Please try again." }, { status: 500, headers: noStore });
  }
}
