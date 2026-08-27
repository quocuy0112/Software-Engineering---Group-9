import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { JobTaxonomyAdminService } from "@/backend/admin/jobs/job-taxonomy-admin-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export async function GET(
  request: Request,
  context: { params: Promise<{ subIndustryId: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    const { subIndustryId } = await context.params;
    return adminJson(
      await new JobTaxonomyAdminService().detail(authority, subIndustryId),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
