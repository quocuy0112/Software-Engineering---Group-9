import {
  adminJson,
  adminRouteError,
  commandHeaders,
  parseAdminJson,
  AdminHttpError,
} from "@/backend/admin/http/admin-route";
import { JobPostManagementService } from "@/backend/jobs/management/job-post-management-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { jobManagementCommandSchema } from "@/shared/contracts/admin/job-post-management";

const actionCommands: Record<string, string> = {
  hide: "HIDE",
  restore: "RESTORE",
  "close-applications": "CLOSE_APPLICATIONS",
  "reopen-applications": "REOPEN_APPLICATIONS",
  archive: "ARCHIVE",
  "request-changes": "REQUEST_CHANGES",
  "soft-delete": "SOFT_DELETE",
  feature: "FEATURE",
  "amend-feature": "AMEND_FEATURE",
  unfeature: "UNFEATURE",
  enforce: "ENFORCE",
};

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string; action: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request, {
      sensitive: true,
    });
    const { jobId, action } = await context.params;
    const expected = actionCommands[action];
    if (!expected) throw new AdminHttpError(404, "TARGET_UNAVAILABLE");
    const command = await parseAdminJson(request, jobManagementCommandSchema);
    if (command.command !== expected)
      throw new AdminHttpError(400, "VALIDATION_FAILED");
    const headers = commandHeaders(request, { strictIfMatch: true });
    if (!headers.idempotencyKey || !Number.isInteger(headers.expectedVersion))
      throw new AdminHttpError(400, "VALIDATION_FAILED");
    return adminJson(
      await new JobPostManagementService().command(
        authority,
        jobId,
        command,
        headers.expectedVersion,
        headers.idempotencyKey,
      ),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
