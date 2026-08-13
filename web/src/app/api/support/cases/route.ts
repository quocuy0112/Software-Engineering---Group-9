import {
  createSupportCaseInputSchema,
  supportCaseListSchema,
} from "@/shared/contracts/support";
import { SupportRequestBoundary } from "@/backend/support/authorization/support-request-boundary";
import {
  parseSupportJson,
  supportJson,
  supportRouteError,
} from "@/backend/support/http/support-route";
import { RequesterSupportService } from "@/backend/support/services/requester-support-service";
import { admitSupportRequest } from "@/backend/support/services/support-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await new SupportRequestBoundary().requireHttp(request);
    const data = await new RequesterSupportService().list(actor.userId);
    return supportJson(
      supportCaseListSchema.parse({ data, total: data.length }),
    );
  } catch (error) {
    return supportRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await new SupportRequestBoundary().requireHttp(request);
    await admitSupportRequest("supportCaseCreate", actor.userId);
    const input = await parseSupportJson(request, createSupportCaseInputSchema);
    const result = await new RequesterSupportService().create(
      actor.userId,
      input,
    );
    return supportJson(
      { data: result.detail, deduplicated: result.deduplicated },
      {
        status: result.deduplicated ? 200 : 201,
      },
    );
  } catch (error) {
    return supportRouteError(error);
  }
}
