import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { BetterAuthSessionGateway } from "@/backend/auth/better-auth/better-auth-session-gateway";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";

export async function POST(request: Request) {
  try {
    await new AdminRequestBoundary().require(request);
    const response = await new BetterAuthSessionGateway().signOut(
      request.headers,
    );
    const headers = new Headers(response.headers);
    return adminJson({ signedOut: true }, { headers });
  } catch (error) {
    return adminRouteError(error);
  }
}
