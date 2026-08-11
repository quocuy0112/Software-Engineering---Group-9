import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AdminAccountService } from "@/backend/admin/accounts/admin-account-service";
import { readAccountCommand } from "@/backend/admin/accounts/account-command-http";
export async function POST(
  request: Request,
  context: { params: Promise<{ accountId: string; sessionReference: string }> },
) {
  try {
    const authority = await new AdminRequestBoundary().require(request, {
      sensitive: true,
    });
    const params = await context.params;
    return adminJson(
      await new AdminAccountService().revokeOne(
        authority,
        params.accountId,
        params.sessionReference,
        await readAccountCommand(request),
      ),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
