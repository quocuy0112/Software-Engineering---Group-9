import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { JobRescoreService } from "@/backend/scoring/services/job-rescore-service";

const noStore = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const current = await requireSession(request.headers);
  if (!current) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Authentication required." }, { status: 401, headers: noStore });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ code: "INVALID_REQUEST", message: "The rescore command is invalid." }, { status: 400, headers: noStore }); }
  try {
    const operation = await new JobRescoreService().request({ userId: current.userId, sessionId: current.sessionId, jobId: (await context.params).jobId, idempotencyKey: request.headers.get("idempotency-key") ?? "", raw });
    return NextResponse.json(operation, { status: 202, headers: noStore });
  } catch (error) {
    const code = error instanceof Error && error.message === "APPLICATION_UNAVAILABLE" ? "UNAVAILABLE" : "INVALID_REQUEST";
    return NextResponse.json({ code, message: code === "UNAVAILABLE" ? "Applications are not available." : "Confirm the background rescore and provide valid versions." }, { status: code === "UNAVAILABLE" ? 404 : 400, headers: noStore });
  }
}
