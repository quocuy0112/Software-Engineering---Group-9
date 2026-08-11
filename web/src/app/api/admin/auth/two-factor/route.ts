import {
  adminFactorSchema,
  AdminAuthService,
} from "@/backend/admin/authorization/admin-auth-service";
import { configuredOrigins } from "@/backend/admin/origins";
import { validateSameOrigin } from "@/backend/security/csrf/csrf";
import {
  readPreAuthCookie,
  clearPreAuthCookie,
} from "@/backend/auth/cookies/pre-auth-cookie";
import {
  adminJson,
  adminNoStoreHeaders,
} from "@/backend/admin/http/admin-route";
import { ADMIN_PRE_AUTH_COOKIE_PATH } from "@/backend/security/cookies";

export async function POST(request: Request) {
  if (!validateSameOrigin(request, configuredOrigins().admin))
    return adminJson({ code: "UNAUTHORIZED" }, { status: 403 });
  const parsed = adminFactorSchema.safeParse(
    await request.json().catch(() => null),
  );
  const preAuth = readPreAuthCookie(request.headers);
  if (!parsed.success || !preAuth)
    return adminJson({ code: "UNAUTHORIZED" }, { status: 401 });
  const sessionCookie = await new AdminAuthService().completeInitialFactor(
    preAuth,
    parsed.data.code,
    request,
  );
  if (!sessionCookie)
    return adminJson({ code: "UNAUTHORIZED" }, { status: 401 });
  const headers = adminNoStoreHeaders();
  headers.append("set-cookie", sessionCookie);
  headers.append("set-cookie", clearPreAuthCookie(ADMIN_PRE_AUTH_COOKIE_PATH));
  return adminJson({ authenticated: true }, { headers });
}
