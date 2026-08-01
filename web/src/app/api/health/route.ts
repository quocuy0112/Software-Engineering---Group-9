import { noStoreHeaders } from "@/backend/security/response-headers";
import { SystemReadinessService } from "@/backend/services/system/system-readiness-service";

export async function GET() {
  const result = await new SystemReadinessService().check();
  return Response.json(
    { status: result.status },
    { status: result.ready ? 200 : 503, headers: noStoreHeaders },
  );
}
