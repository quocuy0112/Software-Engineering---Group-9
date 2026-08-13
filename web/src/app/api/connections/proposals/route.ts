import { participantProposalListSchema } from "@/shared/contracts/connections";
import { ConnectionRequestBoundary } from "@/backend/connections/authorization/connection-request-boundary";
import {
  connectionJson,
  connectionRouteError,
} from "@/backend/connections/http/connection-route";
import { ParticipantProposalService } from "@/backend/connections/services/participant-proposal-service";
import { connectionProposalStateSchema } from "@/shared/contracts/connections";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await new ConnectionRequestBoundary().requireHttp(request);
    const query = new URL(request.url).searchParams;
    const limit = Math.min(50, Math.max(1, Number(query.get("limit") ?? 20)));
    const state = query.get("state");
    const parsedState = state
      ? connectionProposalStateSchema.safeParse(state)
      : null;
    if (state && !parsedState?.success)
      return connectionJson(
        { error: { code: "VALIDATION_ERROR" } },
        { status: 400 },
      );
    return connectionJson(
      participantProposalListSchema.parse(
        await new ParticipantProposalService().list(actor.userId, {
          limit,
          cursor: query.get("cursor") ?? undefined,
          state: parsedState?.data,
        }),
      ),
    );
  } catch (error) {
    return connectionRouteError(error);
  }
}
