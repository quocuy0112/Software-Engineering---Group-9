import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { JobPostManagementService } from "@/backend/jobs/management/job-post-management-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    const { jobId } = await context.params;
    return adminJson(await new JobPostManagementService().detail(authority, jobId));
  } catch (error) { return adminRouteError(error); }
}
