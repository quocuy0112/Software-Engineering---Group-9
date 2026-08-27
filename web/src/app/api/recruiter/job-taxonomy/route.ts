import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { listRecruiterJobTaxonomy } from "@/backend/services/jobs/job-taxonomy-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireSession(request.headers);
  if (!session) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";
  return NextResponse.json(await listRecruiterJobTaxonomy({ forceRefresh }), {
    headers: { "Cache-Control": "no-store" },
  });
}
