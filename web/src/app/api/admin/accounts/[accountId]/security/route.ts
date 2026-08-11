import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AdminAccountService } from "@/backend/admin/accounts/admin-account-service";
export async function GET(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    await new AdminRequestBoundary().require(request);
    return adminJson({
      data: await new AdminAccountService().security(
        (await context.params).accountId,
      ),
    });
  } catch (error) {
    return adminRouteError(error);
  }
}
