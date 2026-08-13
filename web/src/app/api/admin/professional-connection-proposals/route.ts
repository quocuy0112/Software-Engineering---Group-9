import { z } from "zod";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import {
  adminJson,
  adminListQuery,
  adminRouteError,
  parseAdminJson,
} from "@/backend/admin/http/admin-route";
import { createConnectionProposalInputSchema } from "@/shared/contracts/connections";
import { AdminProposalService } from "@/backend/connections/services/admin-proposal-service";
import { ConnectionError } from "@/backend/connections/connection-errors";
import { connectionRouteError } from "@/backend/connections/http/connection-route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await new AdminRequestBoundary().require(request);
    return adminJson(
      await new AdminProposalService().list(adminListQuery(request)),
    );
  } catch (error) {
    return error instanceof ConnectionError
      ? connectionRouteError(error)
      : adminRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    const idempotencyKey = request.headers.get("idempotency-key") ?? "";
    if (!z.uuid().safeParse(idempotencyKey).success)
      return adminJson({ code: "VALIDATION_FAILED" }, { status: 400 });
    const input = await parseAdminJson(
      request,
      createConnectionProposalInputSchema,
    );
    const result = await new AdminProposalService().create(authority, {
      ...input,
      idempotencyKey,
    });
    return adminJson(result, { status: result.deduplicated ? 200 : 201 });
  } catch (error) {
    return error instanceof ConnectionError
      ? connectionRouteError(error)
      : adminRouteError(error);
  }
}
