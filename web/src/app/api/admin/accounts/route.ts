import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AccountListService } from "@/backend/admin/accounts/account-list-service";

export async function GET(request: Request) {
  try {
    await new AdminRequestBoundary().require(request);
    const query = new URL(request.url).searchParams;
    const page = Math.max(1, Number(query.get("page") ?? 1));
    const perPage = Math.min(
      100,
      Math.max(1, Number(query.get("perPage") ?? 25)),
    );
    let filter: Record<string, unknown> = {};
    try {
      filter = JSON.parse(query.get("filter") ?? "{}");
    } catch {
      filter = {};
    }
    return adminJson(
      await new AccountListService().list({ page, perPage, filter }),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
