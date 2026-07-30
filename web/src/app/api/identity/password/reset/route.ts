import {
  resetPasswordSchema,
  PASSWORD_RESET_GENERIC_ERROR,
} from "@/shared/contracts/identity/password-recovery";
import { serverEnvironment } from "@/backend/env/runtime";
import { validateSameOrigin } from "@/backend/security/csrf/csrf";
import { noStoreHeaders } from "@/backend/security/response-headers";
import { clearSessionCookie } from "@/backend/security/cookies";
import { clearPreAuthCookie } from "@/backend/auth/cookies/pre-auth-cookie";
import { ResetPasswordService } from "@/backend/services/recovery/reset-password";

function resetResponseHeaders() {
  const headers = new Headers(noStoreHeaders);
  headers.append("Set-Cookie", clearSessionCookie());
  headers.append("Set-Cookie", clearPreAuthCookie());
  return headers;
}

export async function POST(request: Request) {
  if (!validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL)) {
    return Response.json(
      { message: "Request rejected." },
      { status: 403, headers: noStoreHeaders },
    );
  }
  const parsed = resetPasswordSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { message: PASSWORD_RESET_GENERIC_ERROR },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const result = await new ResetPasswordService().execute(
    parsed.data.token,
    parsed.data.newPassword,
  );
  if (!result.ok) {
    return Response.json(
      {
        message: result.retryable
          ? result.message
          : PASSWORD_RESET_GENERIC_ERROR,
      },
      {
        status: result.retryable ? 503 : 400,
        headers: result.retryable ? resetResponseHeaders() : noStoreHeaders,
      },
    );
  }
  return Response.json(
    { message: "Your password has been reset. Sign in again." },
    { headers: resetResponseHeaders() },
  );
}
