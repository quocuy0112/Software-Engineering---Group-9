import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { JobPostManagementService } from "@/backend/jobs/management/job-post-management-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export async function GET(request: Request) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    const params = new URL(request.url).searchParams;
    let filter: Record<string, unknown> = {};
    try { filter = JSON.parse(params.get("filter") ?? "{}"); } catch { filter = {}; }
    const value = (key: string) => params.get(key) ?? filter[key];
    return adminJson(await new JobPostManagementService().list(authority, {
      page: value("page") ?? 1, perPage: value("perPage") ?? value("pageSize") ?? 25,
      q: value("q") || undefined, visibility: value("visibility") || undefined,
      applicationState: value("applicationState") || undefined,
      featured: value("featured") || undefined, minimumReports: value("minimumReports") || undefined,
    }));
  } catch (error) { return adminRouteError(error); }
}
