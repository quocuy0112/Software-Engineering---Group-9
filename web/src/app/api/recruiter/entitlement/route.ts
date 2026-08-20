import { configuredOrigins } from "@/backend/admin/origins";
import { adminJson } from "@/backend/admin/http/admin-route";
import { RecruiterEntitlementService } from "@/backend/admin/memberships/recruiter-entitlement-service";
function exactHost(request: Request) {
  const expected = new URL(configuredOrigins().recruiter);
  return (
    (request.headers.get("host") ?? new URL(request.url).host).toLowerCase() ===
    expected.host.toLowerCase()
  );
}
export async function GET(request: Request) {
  if (!exactHost(request))
    return adminJson({ code: "UNAVAILABLE" }, { status: 404 });
  const selected =
    new URL(request.url).searchParams.get("companyId") ?? undefined;
  return adminJson(
    await new RecruiterEntitlementService().resolve(request, selected),
  );
}
