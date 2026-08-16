import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { JobRescoreService } from "@/backend/scoring/services/job-rescore-service";

const noStore = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, context: { params: Promise<{ jobId: string; operationId: string }> }) {
  const current = await requireSession(request.headers);
  if (!current) return NextResponse.json({ code: "UNAUTHENTICATED", message: "Authentication required." }, { status: 401, headers: noStore });
  const params = await context.params;
  try {
    const operation = await new JobRescoreService().status({ userId: current.userId, jobId: params.jobId, operationId: params.operationId });
    return NextResponse.json(operation, { headers: noStore });
  } catch {
    return NextResponse.json({ code: "UNAVAILABLE", message: "The rescore operation is not available." }, { status: 404, headers: noStore });
  }
}
