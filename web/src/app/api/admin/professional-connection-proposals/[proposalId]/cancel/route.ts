import { z } from "zod";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import {
  adminJson,
  adminRouteError,
  parseAdminJson,
} from "@/backend/admin/http/admin-route";
import { AdminProposalService } from "@/backend/connections/services/admin-proposal-service";
import { ConnectionError } from "@/backend/connections/connection-errors";
import { connectionRouteError } from "@/backend/connections/http/connection-route";

export async function POST(
  request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    const body = await parseAdminJson(
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
      return adminJson({ code: "VALIDATION_FAILED" }, { status: 400 });
    }
    return adminJson(
      await new AdminProposalService().cancel(
        authority,
        (await context.params).proposalId,
        { expectedVersion, idempotencyKey },
      ),
    );
  } catch (error) {
    return error instanceof ConnectionError
      ? connectionRouteError(error)
      : adminRouteError(error);
  }
}
