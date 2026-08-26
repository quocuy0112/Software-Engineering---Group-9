import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { JobPostReviewService } from "@/backend/jobs/review/job-post-review-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { jobPostReviewListQuerySchema } from "@/shared/contracts/admin/job-post-review";

function listQuery(request: Request) {
  const parameters = new URL(request.url).searchParams;
  let reactAdminFilter: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(parameters.get("filter") ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      reactAdminFilter = parsed as Record<string, unknown>;
  } catch {
    reactAdminFilter = {};
  }
  const value = (key: string) => parameters.get(key) ?? reactAdminFilter[key];
  const numeric = (key: string) => {
    const supplied = value(key);
    return supplied === undefined || supplied === null || supplied === ""
      ? undefined
      : Number(supplied);
  };
  const assignment = value("assignment");
  return jobPostReviewListQuerySchema.parse({
    page: numeric("page") ?? 1,
    perPage: numeric("perPage") ?? 25,
    state: value("state") || undefined,
    q: value("q") || undefined,
    assignment:
      typeof assignment === "string" && assignment
        ? assignment.toUpperCase()
        : undefined,
    companyId: value("companyId") || undefined,
    minimumAgeHours: numeric("minimumAgeHours"),
    sequence: numeric("sequence"),
    recordStatus: value("recordStatus") || undefined,
  });
}

export async function GET(request: Request) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    return adminJson(
      await new JobPostReviewService().list(authority, listQuery(request)),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
