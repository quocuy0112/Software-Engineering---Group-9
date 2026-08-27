import {
  adminJson,
  adminRouteError,
  adminListQuery,
} from "@/backend/admin/http/admin-route";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { JobTaxonomyAdminService } from "@/backend/admin/jobs/job-taxonomy-admin-service";

export async function GET(request: Request) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    const query = adminListQuery(request);
    const filter = query.filter;
    return adminJson(
      await new JobTaxonomyAdminService().list(authority, {
        page: query.page,
        perPage: query.perPage,
        q: typeof filter.q === "string" ? filter.q : undefined,
        status: typeof filter.status === "string" ? filter.status : undefined,
        industryCode:
          typeof filter.industryCode === "string"
            ? filter.industryCode
            : undefined,
      }),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
