import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { VerificationReviewService } from "@/backend/admin/verification/verification-review-service";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";

export async function GET(request: Request) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    const query = new URL(request.url).searchParams;
    let filter: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(query.get("filter") ?? "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        filter = parsed as Record<string, unknown>;
    } catch {
      throw new Error("VALIDATION_FAILED");
    }
    for (const name of [
      "state",
      "applicantEligibility",
      "company",
      "targetCompanyId",
      "taxCode",
      "submittedFrom",
      "submittedTo",
      "applicantId",
      "assignment",
    ]) {
      if (query.has(name)) filter[name] = query.get(name);
    }
    const page = Number(query.get("page") ?? 1);
    const pageSize = Number(
      query.get("pageSize") ?? query.get("perPage") ?? 25,
    );
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      ![25, 50, 100].includes(pageSize)
    )
      throw new Error("VALIDATION_FAILED");
    return adminJson(
      await new VerificationReviewService().listQueue({
        page,
        pageSize,
        adminUserId: authority.userId,
        filter,
      }),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
