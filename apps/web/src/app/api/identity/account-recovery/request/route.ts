import {
  accountRecoveryRequestSchema,
  ACCOUNT_RECOVERY_INVALID_EMAIL_ERROR,
} from "@/features/identity/schemas/password-recovery";
import { serverEnvironment } from "@/lib/env/runtime";
import { validateSameOrigin } from "@/lib/security/csrf";
import { noStoreHeaders } from "@/lib/security/response-headers";
import { RequestFullAccountRecoveryService } from "@/server/services/identity/request-full-account-recovery";

export async function POST(request: Request) {
  if (!validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL)) {
    return Response.json(
      { message: "Request rejected." },
      { status: 403, headers: noStoreHeaders },
    );
  }
  const parsed = accountRecoveryRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { message: ACCOUNT_RECOVERY_INVALID_EMAIL_ERROR },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const result = await new RequestFullAccountRecoveryService().execute(
    parsed.data.email,
  );
  const headers = new Headers(noStoreHeaders);
  if ("retryAfterSeconds" in result) {
    headers.set("Retry-After", String(result.retryAfterSeconds));
  }
  return Response.json(
    { message: result.message },
    { status: result.status, headers },
  );
}
