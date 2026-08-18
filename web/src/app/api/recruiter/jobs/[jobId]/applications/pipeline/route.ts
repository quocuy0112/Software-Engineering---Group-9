import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { RecruitmentPipelineBoardService } from "@/backend/applications/services/recruitment-pipeline-board";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const current = await requireSession(request.headers);
  if (!current) return NextResponse.json({ code: "AUTHENTICATION_REQUIRED", message: "Authentication required." }, { status: 401, headers });
  try {
    const result = await new RecruitmentPipelineBoardService().metadata({ userId: current.userId, jobId: (await context.params).jobId });
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json({ code: "APPLICATION_UNAVAILABLE", message: "The recruitment pipeline is unavailable." }, { status: 404, headers });
  }
}
