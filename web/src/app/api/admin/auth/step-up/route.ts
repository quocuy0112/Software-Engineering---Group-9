import {
  adminFactorSchema,
  AdminAuthService,
} from "@/backend/admin/authorization/admin-auth-service";
import { adminJson, adminRouteError } from "@/backend/admin/http/admin-route";

export async function POST(request: Request) {
  try {
    const parsed = adminFactorSchema.parse(await request.json());
    if (!(await new AdminAuthService().stepUp(request, parsed.code))) {
      return adminJson({ code: "UNAUTHORIZED" }, { status: 401 });
    }
    return adminJson({
      verified: true,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
  } catch (error) {
    return adminRouteError(error);
  }
}
