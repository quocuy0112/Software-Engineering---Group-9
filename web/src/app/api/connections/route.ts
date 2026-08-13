import { professionalConnectionListSchema } from "@/shared/contracts/connections";
import { ConnectionRequestBoundary } from "@/backend/connections/authorization/connection-request-boundary";
import {
  connectionJson,
  connectionRouteError,
} from "@/backend/connections/http/connection-route";
import { ConnectionService } from "@/backend/connections/services/connection-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await new ConnectionRequestBoundary().requireHttp(request);
    const query = new URL(request.url).searchParams;
    const limit = Math.min(50, Math.max(1, Number(query.get("limit") ?? 20)));
    const state = query.get("state");
    if (state && state !== "ACCEPTED" && state !== "REVOKED")
      return connectionJson(
        { error: { code: "VALIDATION_ERROR" } },
        { status: 400 },
      );
    return connectionJson(
      professionalConnectionListSchema.parse(
        await new ConnectionService().list(actor.userId, {
          limit,
          cursor: query.get("cursor") ?? undefined,
          state: state as "ACCEPTED" | "REVOKED" | undefined,
        }),
      ),
    );
  } catch (error) {
    return connectionRouteError(error);
  }
}
