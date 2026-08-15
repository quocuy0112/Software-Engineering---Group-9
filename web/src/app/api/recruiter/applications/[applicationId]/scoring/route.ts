import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { ScoringDetailService } from "@/backend/scoring/services/scoring-detail-service";

const noStore = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  const current = await requireSession(request.headers);
  if (!current) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Authentication required." }, { status: 401, headers: noStore });
  try {
    return NextResponse.json(await new ScoringDetailService().get(current.userId, (await context.params).applicationId), { headers: noStore });
  } catch {
    return NextResponse.json({ code: "UNAVAILABLE", message: "The application is not available." }, { status: 404, headers: noStore });
  }
}
