import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { AiRetryService } from "@/backend/scoring/services/ai-retry-service";

const noStore = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  const current = await requireSession(request.headers);
  if (!current) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Authentication required." }, { status: 401, headers: noStore });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ code: "INVALID_REQUEST", message: "Confirm the AI retry." }, { status: 400, headers: noStore }); }
  try {
    const result = await new AiRetryService().request({ userId: current.userId, sessionId: current.sessionId, applicationId: (await context.params).applicationId, idempotencyKey: request.headers.get("idempotency-key") ?? "", raw });
    return NextResponse.json(result, { status: 202, headers: noStore });
  } catch (error) {
    const unavailable = error instanceof Error && error.message === "APPLICATION_UNAVAILABLE";
    return NextResponse.json({ code: unavailable ? "UNAVAILABLE" : "INVALID_REQUEST", message: unavailable ? "The application is not available." : "AI retry is not available in the current state." }, { status: unavailable ? 404 : 409, headers: noStore });
  }
}
