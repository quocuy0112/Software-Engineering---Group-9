import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { RecruiterApplicationDecisionService } from "@/backend/applications/services/recruiter-application-decision-service";

const noStore = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  const current = await requireSession(request.headers);
  if (!current) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Authentication required." }, { status: 401, headers: noStore });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ code: "INVALID_REQUEST", message: "Provide a rejection reason." }, { status: 400, headers: noStore }); }
  try {
    const result = await new RecruiterApplicationDecisionService().reject({ userId: current.userId, sessionId: current.sessionId, applicationId: (await context.params).applicationId, idempotencyKey: request.headers.get("idempotency-key") ?? "", raw });
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    const unavailable = error instanceof Error && error.message === "APPLICATION_UNAVAILABLE";
    const conflict = error instanceof Error && (error.message === "DECISION_CONFLICT" || error.message === "INVALID_DECISION_STAGE");
    return NextResponse.json({ code: unavailable ? "UNAVAILABLE" : conflict ? "CONFLICT" : "INVALID_REQUEST", message: unavailable ? "The application is not available." : conflict ? "This decision is no longer valid. Refresh the application." : "Choose a standardized rejection reason and confirm the decision." }, { status: unavailable ? 404 : conflict ? 409 : 400, headers: noStore });
  }
}
