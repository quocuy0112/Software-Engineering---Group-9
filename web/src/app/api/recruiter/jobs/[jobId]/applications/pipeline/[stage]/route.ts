import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { RecruitmentPipelineBoardService } from "@/backend/applications/services/recruitment-pipeline-board";
import { applicationStageSchema, pipelineStagePageQuerySchema } from "@/shared/contracts/applications";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, context: { params: Promise<{ jobId: string; stage: string }> }) {
  const current = await requireSession(request.headers);
  if (!current) return NextResponse.json({ code: "AUTHENTICATION_REQUIRED", message: "Authentication required." }, { status: 401, headers });
  const path = await context.params;
  const url = new URL(request.url);
  const parsed = pipelineStagePageQuerySchema.safeParse({ cursor: url.searchParams.get("cursor") ?? undefined, limit: url.searchParams.get("limit") ?? undefined });
  const stage = applicationStageSchema.safeParse(path.stage);
  if (!parsed.success || !stage.success) return NextResponse.json({ code: "INVALID_REQUEST", message: "The pipeline page request is invalid." }, { status: 400, headers });
  try {
    const result = await new RecruitmentPipelineBoardService().stagePage({ userId: current.userId, jobId: path.jobId, stage: stage.data, ...parsed.data });
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") return NextResponse.json({ code: "INVALID_REQUEST", message: "The pipeline cursor is invalid." }, { status: 400, headers });
    return NextResponse.json({ code: "APPLICATION_UNAVAILABLE", message: "The recruitment pipeline is unavailable." }, { status: 404, headers });
  }
}
