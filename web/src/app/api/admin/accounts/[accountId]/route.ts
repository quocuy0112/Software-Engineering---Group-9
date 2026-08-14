import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AccountDetailService } from "@/backend/admin/accounts/account-detail-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    await new AdminRequestBoundary().require(request);
    const result = await new AccountDetailService().get(
      (await context.params).accountId,
    );
    if (!result) throw new Error("TARGET_UNAVAILABLE");
    return adminJson(result);
  } catch (error) {
    return adminRouteError(error);
  }
}
