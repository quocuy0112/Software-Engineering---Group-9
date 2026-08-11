import { configuredOrigins } from "@/backend/admin/origins";
import { validateSameOrigin } from "@/backend/security/csrf/csrf";
import {
  adminLoginSchema,
  AdminAuthService,
} from "@/backend/admin/authorization/admin-auth-service";
import {
  adminJson,
  adminNoStoreHeaders,
} from "@/backend/admin/http/admin-route";

export async function POST(request: Request) {
  if (!validateSameOrigin(request, configuredOrigins().admin)) {
    return adminJson({ code: "UNAUTHORIZED" }, { status: 403 });
  }
  const parsed = adminLoginSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return adminJson({ code: "UNAUTHORIZED" }, { status: 401 });
  const response = await new AdminAuthService().login(parsed.data, request);
  const headers = adminNoStoreHeaders(response.headers);
  return new Response(response.body, { status: response.status, headers });
}
