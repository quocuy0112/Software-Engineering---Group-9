import {
  AdminHttpError,
  adminJson,
  adminRouteError,
  commandHeaders,
  parseAdminJson,
} from "@/backend/admin/http/admin-route";
import { JobTaxonomyAdminService } from "@/backend/admin/jobs/job-taxonomy-admin-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { jobTaxonomyCommandSchema } from "@/shared/contracts/admin/job-taxonomy";

const actionCommands = {
  deactivate: "DEACTIVATE",
  reactivate: "REACTIVATE",
  remove: "REMOVE",
} as const;

export async function POST(
  request: Request,
  context: {
    params: Promise<{ subIndustryId: string; action: string }>;
  },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request, {
      sensitive: true,
    });
    const { subIndustryId, action } = await context.params;
    const expected = actionCommands[action as keyof typeof actionCommands];
    if (!expected) throw new AdminHttpError(404, "TARGET_UNAVAILABLE");
    const command = await parseAdminJson(request, jobTaxonomyCommandSchema);
    if (command.command !== expected)
      throw new AdminHttpError(400, "VALIDATION_FAILED");
    const headers = commandHeaders(request, { strictIfMatch: true });
    if (!headers.idempotencyKey || !Number.isInteger(headers.expectedVersion))
      throw new AdminHttpError(400, "VALIDATION_FAILED");
    return adminJson(
      await new JobTaxonomyAdminService().command(
        authority,
        subIndustryId,
        command,
        headers.expectedVersion,
        headers.idempotencyKey,
      ),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
