import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AdminAccountService } from "@/backend/admin/accounts/admin-account-service";
import { readAccountModerationCommand } from "@/backend/admin/accounts/account-command-http";
export async function POST(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request, {
      sensitive: true,
    });
    return adminJson(
      await new AdminAccountService().suspend(
        authority,
        (await context.params).accountId,
        await readAccountModerationCommand(request),
      ),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
