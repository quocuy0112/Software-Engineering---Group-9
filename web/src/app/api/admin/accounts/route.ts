import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AccountDirectoryService } from "@/backend/admin/accounts/account-directory-service";

export async function GET(request: Request) {
  try {
    await new AdminRequestBoundary().require(request);
    const query = new URL(request.url).searchParams;
    return adminJson(
      await new AccountDirectoryService().list({
        q: query.get("q") ?? undefined,
        type: query.get("type") ?? undefined,
        status: query.get("status") ?? undefined,
        registeredFrom: query.get("registeredFrom") ?? undefined,
        registeredTo: query.get("registeredTo") ?? undefined,
        page: query.get("page") ?? undefined,
        pageSize: query.get("pageSize") ?? undefined,
      }),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
