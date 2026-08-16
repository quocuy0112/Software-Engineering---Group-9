import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { CampaignScoringStatsService } from "@/backend/applications/services/campaign-scoring-stats";

const noStore = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  const current = await requireSession(request.headers);
  if (!current) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "Authentication required." },
      { status: 401, headers: noStore },
    );
  }

  const rawJobIds = new URL(request.url).searchParams.get("jobIds") ?? "";
  const jobIds = [
    ...new Set(
      rawJobIds
        .split(",")
        .map((jobId) => jobId.trim())
        .filter(Boolean),
    ),
  ];
  if (jobIds.length > 100) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "Too many job ids." },
      { status: 400, headers: noStore },
    );
  }

  try {
    const result = await new CampaignScoringStatsService().execute({
      userId: current.userId,
      jobIds,
    });
    return NextResponse.json(result, { headers: noStore });
  } catch {
    return NextResponse.json(
      { code: "UNAVAILABLE", message: "Scoring insights are not available." },
      { status: 503, headers: noStore },
    );
  }
}
