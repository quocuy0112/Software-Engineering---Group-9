import { csrfProof } from "@/backend/security/csrf/csrf-proof";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";
import { AdminAuthService } from "@/backend/admin/authorization/admin-auth-service";

export async function GET(request: Request) {
  try {
    const authority = await new AdminRequestBoundary().require(request);
    const context = await new AdminAuthService().context(authority);
    return adminJson({
      accountId: authority.userId,
      displayName: context.displayName,
      grantId: authority.grantId,
      csrfToken: csrfProof(authority.sessionId),
      stepUpExpiresAt: new Date(
        authority.proofAt.getTime() + 15 * 60_000,
      ).toISOString(),
    });
  } catch (error) {
    return adminRouteError(error);
  }
}
