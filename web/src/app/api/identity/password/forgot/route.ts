import {
  forgotPasswordSchema,
  PASSWORD_RECOVERY_INVALID_EMAIL_ERROR,
} from "@/shared/contracts/identity/password-recovery";
import { serverEnvironment } from "@/backend/env/runtime";
import { validateSameOrigin } from "@/backend/security/csrf/csrf";
import { noStoreHeaders } from "@/backend/security/response-headers";
import { RequestPasswordResetService } from "@/backend/services/recovery/request-password-reset";

export async function POST(request: Request) {
  if (!validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL)) {
    return Response.json(
      { message: "Request rejected." },
      { status: 403, headers: noStoreHeaders },
    );
  }
  const parsed = forgotPasswordSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { message: PASSWORD_RECOVERY_INVALID_EMAIL_ERROR },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const result = await new RequestPasswordResetService().execute(
    parsed.data.email,
    "anonymous",
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
