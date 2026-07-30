import {
  accountRecoveryActionSchema,
  ACCOUNT_RECOVERY_GENERIC_ERROR,
} from "@/shared/contracts/identity/password-recovery";
import { serverEnvironment } from "@/backend/env/runtime";
import {
  clearAccountRecoveryCapability,
  readAccountRecoveryCapability,
} from "@/backend/security/account-recovery-capability";
import { clearSessionCookie } from "@/backend/security/cookies";
import { validateSameOrigin } from "@/backend/security/csrf/csrf";
import { noStoreHeaders } from "@/backend/security/response-headers";
import { clearPreAuthCookie } from "@/backend/auth/cookies/pre-auth-cookie";
import { CancelFullAccountRecoveryService } from "@/backend/services/recovery/cancel-full-account-recovery";

function clearedAuthenticationHeaders() {
  const headers = new Headers(noStoreHeaders);
  headers.append("Set-Cookie", clearSessionCookie());
  headers.append("Set-Cookie", clearPreAuthCookie());
  headers.append("Set-Cookie", clearAccountRecoveryCapability());
  return headers;
}

export async function POST(request: Request) {
  if (!validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL)) {
    return Response.json(
      { message: "Request rejected." },
      { status: 403, headers: noStoreHeaders },
    );
  }
  const capability = readAccountRecoveryCapability(
    request.headers,
    "cancellation",
  );
  if (!capability) {
    const headers = new Headers(noStoreHeaders);
    headers.append("Set-Cookie", clearAccountRecoveryCapability());
    return Response.json(
      { message: ACCOUNT_RECOVERY_GENERIC_ERROR },
      { status: 403, headers },
    );
  }
  const parsed = accountRecoveryActionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const headers = new Headers(noStoreHeaders);
    headers.append("Set-Cookie", clearAccountRecoveryCapability());
    return Response.json(
      { message: ACCOUNT_RECOVERY_GENERIC_ERROR },
      { status: 400, headers },
    );
  }
  const result = await new CancelFullAccountRecoveryService().execute(
    capability.proof,
  );
  return result.ok
    ? Response.json(
        {
          status: "success",
          message:
            "Account recovery was cancelled. Sign in with your existing password and second factor.",
        },
        { headers: clearedAuthenticationHeaders() },
      )
    : Response.json(
        { message: ACCOUNT_RECOVERY_GENERIC_ERROR },
        { status: 400, headers: clearedAuthenticationHeaders() },
      );
}
