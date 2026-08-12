import { NextResponse } from "next/server";
import { requireSession } from "@/backend/auth/session/require-session";
import { isCandidateRequestHost } from "@/backend/auth/candidate-host-boundary";
import { getRecruiterHeaderStatusService } from "@/backend/recruiter-header/recruiter-header-status-service-factory";
import {
  recruiterHeaderErrorSchema,
  recruiterHeaderStatusSchema,
} from "@/shared/contracts/recruiter-header-status";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function errorResponse(
  code: "UNAUTHORIZED" | "UNAVAILABLE" | "STATUS_UNAVAILABLE",
  status: 401 | 404 | 503,
) {
  return NextResponse.json(recruiterHeaderErrorSchema.parse({ code }), {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export async function GET(request: Request) {
  if (!isCandidateRequestHost(request.headers)) {
    return errorResponse("UNAVAILABLE", 404);
  }

  const current = await requireSession(request.headers);
  if (!current) return errorResponse("UNAUTHORIZED", 401);

  try {
    const projection = await getRecruiterHeaderStatusService().resolveForUser(
      current.userId,
    );
    return NextResponse.json(recruiterHeaderStatusSchema.parse(projection), {
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return errorResponse("STATUS_UNAVAILABLE", 503);
  }
}
