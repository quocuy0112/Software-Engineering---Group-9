import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { readAccountCommand } from "@/backend/admin/accounts/account-command-http";
import { CompanyModerationService } from "@/backend/admin/companies/company-moderation-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ companyId: string; action: string }> },
) {
  try {
    const { companyId, action } = await context.params;
    if (action !== "ban" && action !== "unban")
      throw new Error("TARGET_UNAVAILABLE");
    const authority = await new AdminRequestBoundary().require(request, {
      sensitive: true,
    });
    const command = await readAccountCommand(request);
    const service = new CompanyModerationService();
    return adminJson(
      action === "ban"
        ? await service.ban(authority, companyId, command)
        : await service.unban(authority, companyId, command),
    );
  } catch (error) {
    return adminRouteError(error);
  }
}
