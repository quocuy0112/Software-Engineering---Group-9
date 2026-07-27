import {
  completeAccountRecoveryActionSchema,
  ACCOUNT_RECOVERY_GENERIC_ERROR,
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
import { CompleteFullAccountRecoveryService } from "@/server/services/identity/complete-full-account-recovery";

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
    "completion",
  );
  if (!capability) {
    const headers = new Headers(noStoreHeaders);
    headers.append("Set-Cookie", clearAccountRecoveryCapability());
    return Response.json(
      { message: ACCOUNT_RECOVERY_GENERIC_ERROR },
      { status: 403, headers },
    );
  }
  const parsed = completeAccountRecoveryActionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { message: ACCOUNT_RECOVERY_GENERIC_ERROR },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const result = await new CompleteFullAccountRecoveryService().execute(
    capability.proof,
    parsed.data.newPassword,
  );
  if (!result.ok) {
    const status = result.holdEndsAt ? 409 : result.retryable ? 503 : 400;
    const headers =
      result.retryable || result.holdEndsAt
        ? clearedAuthenticationHeaders()
        : new Headers(noStoreHeaders);
    if (!result.retryable && !result.holdEndsAt) {
      headers.append("Set-Cookie", clearAccountRecoveryCapability());
    }
    return Response.json(
      {
        message: result.holdEndsAt
          ? result.message
          : result.retryable
            ? result.message
            : ACCOUNT_RECOVERY_GENERIC_ERROR,
        ...(result.holdEndsAt
          ? { holdEndsAt: result.holdEndsAt.toISOString() }
          : {}),
      },
      {
        status,
        headers,
      },
    );
  }
  return Response.json(
    {
      status: "success",
      message:
        "Account recovery is complete. Sign in with your new password and re-enroll two-factor authentication.",
      next: "/login",
      twoFactorRecommendation:
        "Re-enroll two-factor authentication after your next login.",
    },
    { headers: clearedAuthenticationHeaders(true) },
  );
}
