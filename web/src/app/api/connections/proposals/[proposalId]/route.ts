import { participantProposalSchema } from "@/shared/contracts/connections";
import { ConnectionRequestBoundary } from "@/backend/connections/authorization/connection-request-boundary";
import {
  connectionJson,
  connectionRouteError,
} from "@/backend/connections/http/connection-route";
import { ParticipantProposalService } from "@/backend/connections/services/participant-proposal-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  try {
    const actor = await new ConnectionRequestBoundary().requireHttp(request);
    const data = await new ParticipantProposalService().detail(
      (await context.params).proposalId,
      actor.userId,
    );
    return data
      ? connectionJson({ data: participantProposalSchema.parse(data) })
      : connectionJson(
          { error: { code: "RESOURCE_UNAVAILABLE" } },
          { status: 404 },
        );
  } catch (error) {
    return connectionRouteError(error);
  }
}
