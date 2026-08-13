import { z } from "zod";
import { professionalConnectionSchema } from "@/shared/contracts/connections";
import { ConnectionRequestBoundary } from "@/backend/connections/authorization/connection-request-boundary";
import {
  connectionJson,
  connectionRouteError,
  parseConnectionJson,
} from "@/backend/connections/http/connection-route";
import { ConnectionService } from "@/backend/connections/services/connection-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  try {
    const actor = await new ConnectionRequestBoundary().requireHttp(request);
    const body = await parseConnectionJson(
      request,
      z.object({ confirmation: z.literal(true) }).strict(),
    );
    void body;
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
    const result = await new ConnectionService().disconnect(
      actor,
      (await context.params).connectionId,
      { expectedVersion, idempotencyKey },
    );
    return connectionJson({
      ...result,
      data: professionalConnectionSchema.parse(result.data),
    });
  } catch (error) {
    return connectionRouteError(error);
  }
}
