import {
  accountRecoveryProofSchema,
  ACCOUNT_RECOVERY_GENERIC_ERROR,
  ACCOUNT_RECOVERY_LOWER_ASSURANCE_NOTICE,
} from "@/features/identity/schemas/password-recovery";
import { serverEnvironment } from "@/lib/env/runtime";
import { clearSessionCookie } from "@/lib/security/cookies";
import { validateSameOrigin } from "@/lib/security/csrf";
import { noStoreHeaders } from "@/lib/security/response-headers";
import { clearPreAuthCookie } from "@/server/auth/identity/pre-auth-cookie";
import { ConfirmFullAccountRecoveryService } from "@/server/services/identity/confirm-full-account-recovery";

function clearedAuthenticationHeaders() {
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
  const parsed = accountRecoveryProofSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { message: ACCOUNT_RECOVERY_GENERIC_ERROR },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const result = await new ConfirmFullAccountRecoveryService().execute(
    parsed.data.proof,
  );
  if (!result.ok) {
    return Response.json(
      {
        message: result.retryable
          ? result.message
          : ACCOUNT_RECOVERY_GENERIC_ERROR,
      },
      {
        status: result.retryable ? 503 : 400,
        headers: result.retryable
          ? clearedAuthenticationHeaders()
          : noStoreHeaders,
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
    { status: 202, headers: clearedAuthenticationHeaders() },
  );
}
