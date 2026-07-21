import { passwordProofSchema } from "@/features/identity/schemas/two-factor";
import { noStoreHeaders } from "@/lib/security/response-headers";
import { validateSameOrigin } from "@/lib/security/csrf";
import { validCsrfProof } from "@/lib/security/csrf-proof";
import { serverEnvironment } from "@/lib/env/runtime";
import { requireSession } from "@/server/auth/require-session";
import { EnrollTotpService } from "@/server/services/identity/enroll-totp";

/**
 * Starts TOTP enrollment. Requires an authenticated ACTIVE session, same-origin
 * request, CSRF proof, and recent current-password re-proof (enforced by the
 * service). Returns a one-time setup response that must never be cached; the
 * password, otpauth URI, secret, and QR payload never appear in the URL or logs.
 */
export async function POST(request: Request) {
  const current = await requireSession(request.headers);
  if (!current) return Response.json({ message: "Authentication required." }, { status: 401, headers: noStoreHeaders });
  if (
    !validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL) ||
    !validCsrfProof(current.sessionId, request.headers.get("x-csrf-token"))
  ) {
    return Response.json({ message: "Request rejected." }, { status: 403, headers: noStoreHeaders });
  }

  const parsed = passwordProofSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ message: "Review the highlighted fields.", fields: parsed.error.flatten().fieldErrors }, { status: 400, headers: noStoreHeaders });
  }

  const subject = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const result = await new EnrollTotpService().start(parsed.data.currentPassword, { headers: request.headers, subject });
  if (!result.ok) {
    const headers = new Headers(noStoreHeaders);
    if (result.status === 429 && result.retryAfterSeconds) headers.set("Retry-After", String(result.retryAfterSeconds));
    return Response.json({ message: "Please confirm your current password to continue." }, { status: result.status, headers });
  }

  return Response.json(
    { qrCodeDataUrl: result.qrCodeDataUrl, manualKey: result.manualKey, issuer: result.issuer, accountLabel: result.accountLabel },
    { headers: noStoreHeaders },
  );
}
