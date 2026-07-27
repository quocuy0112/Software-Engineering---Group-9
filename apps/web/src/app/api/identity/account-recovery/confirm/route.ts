import {
  accountRecoveryActionSchema,
  ACCOUNT_RECOVERY_GENERIC_ERROR,
  ACCOUNT_RECOVERY_LOWER_ASSURANCE_NOTICE,
} from "@/features/identity/schemas/password-recovery";
import { serverEnvironment } from "@/lib/env/runtime";
import {
  clearAccountRecoveryCapability,
  readAccountRecoveryCapability,
} from "@/lib/security/account-recovery-capability";
import { clearSessionCookie } from "@/lib/security/cookies";
import { validateSameOrigin } from "@/lib/security/csrf";
import { noStoreHeaders } from "@/lib/security/response-headers";
import { clearPreAuthCookie } from "@/server/auth/identity/pre-auth-cookie";
import { ConfirmFullAccountRecoveryService } from "@/server/services/identity/confirm-full-account-recovery";

function clearedAuthenticationHeaders(clearCapability = false) {
  const headers = new Headers(noStoreHeaders);
  headers.append("Set-Cookie", clearSessionCookie());
  headers.append("Set-Cookie", clearPreAuthCookie());
  if (clearCapability) {
    headers.append("Set-Cookie", clearAccountRecoveryCapability());
  }
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
    "confirmation",
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
  const result = await new ConfirmFullAccountRecoveryService().execute(
    capability.proof,
  );
  if (!result.ok) {
    const headers = result.retryable
      ? clearedAuthenticationHeaders()
      : new Headers(noStoreHeaders);
    if (!result.retryable) {
      headers.append("Set-Cookie", clearAccountRecoveryCapability());
    }
    return Response.json(
      {
        message: result.retryable
          ? result.message
          : ACCOUNT_RECOVERY_GENERIC_ERROR,
      },
      {
        status: result.retryable ? 503 : 400,
        headers,
      },
    );
  }
  return Response.json(
    {
      status: "hold-active",
      holdEndsAt: result.holdEndsAt.toISOString(),
      lowerAssuranceNotice: ACCOUNT_RECOVERY_LOWER_ASSURANCE_NOTICE,
      message:
        "The 24-hour security hold has started. Check your email for cancellation and completion links.",
    },
    { status: 202, headers: clearedAuthenticationHeaders(true) },
  );
}
