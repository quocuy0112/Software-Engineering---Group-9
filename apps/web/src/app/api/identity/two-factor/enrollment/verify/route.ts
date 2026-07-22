import { totpCodeSchema } from "@/features/identity/schemas/two-factor";
import { noStoreHeaders } from "@/lib/security/response-headers";
import { validateSameOrigin } from "@/lib/security/csrf";
import { validCsrfProof } from "@/lib/security/csrf-proof";
import { serverEnvironment } from "@/lib/env/runtime";
import { requireSession } from "@/server/auth/require-session";
import { EnrollTotpService } from "@/server/services/identity/enroll-totp";

/**
 * Verifies the initial six-digit TOTP code, enables 2FA, and returns the ten
 * backup codes exactly once. Requires an authenticated ACTIVE session,
 * same-origin request, and CSRF proof. The verification code and backup codes
 * never appear in the URL or logs, and the response is never cached.
 */
export async function POST(request: Request) {
  const current = await requireSession(request.headers);
  if (!current)
    return Response.json(
      { message: "Authentication required." },
      { status: 401, headers: noStoreHeaders },
    );
  if (
    !validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL) ||
    !validCsrfProof(current.sessionId, request.headers.get("x-csrf-token"))
  ) {
    return Response.json(
      { message: "Request rejected." },
      { status: 403, headers: noStoreHeaders },
    );
  }

  const parsed = totpCodeSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { message: "Enter the six-digit code from your authenticator app." },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const result = await new EnrollTotpService().verify(parsed.data.code, {
    headers: request.headers,
    subject: current.userId,
  });
  if (!result.ok) {
    const headers = new Headers(noStoreHeaders);
    if (result.status === 429 && result.retryAfterSeconds)
      headers.set("Retry-After", String(result.retryAfterSeconds));
    return Response.json(
      { message: "That code could not be verified." },
      { status: result.status, headers },
    );
  }

  return Response.json(
    { backupCodes: result.backupCodes },
    { headers: noStoreHeaders },
  );
}
