import { z } from "zod";
import {
  connectionDecisionSchema,
  participantProposalSchema,
} from "@/shared/contracts/connections";
import { ConnectionRequestBoundary } from "@/backend/connections/authorization/connection-request-boundary";
import {
  connectionJson,
  connectionRouteError,
  parseConnectionJson,
} from "@/backend/connections/http/connection-route";
import { ParticipantProposalService } from "@/backend/connections/services/participant-proposal-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  try {
    const actor = await new ConnectionRequestBoundary().requireHttp(request);
    const body = await parseConnectionJson(
      request,
      z.object({ decision: connectionDecisionSchema }).strict(),
    );
    const expectedVersion = Number(request.headers.get("if-match-version"));
    const idempotencyKey = request.headers.get("idempotency-key") ?? "";
    if (
      !Number.isInteger(expectedVersion) ||
      expectedVersion < 1 ||
      !z.uuid().safeParse(idempotencyKey).success
    ) {
      return connectionJson(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "The request is invalid.",
          },
        },
        { status: 400 },
      );
    }
    const result = await new ParticipantProposalService().decide(
      actor,
      (await context.params).proposalId,
      { ...body, expectedVersion, idempotencyKey },
    );
    return connectionJson({
      ...result,
      data: participantProposalSchema.parse(result.data),
    });
  } catch (error) {
    return connectionRouteError(error);
  }
}
