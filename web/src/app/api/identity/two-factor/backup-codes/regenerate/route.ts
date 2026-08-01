import { twoFactorManagementSchema } from "@/shared/contracts/identity/two-factor";
import { validateSameOrigin } from "@/backend/security/csrf/csrf";
import { validCsrfProof } from "@/backend/security/csrf/csrf-proof";
import { serverEnvironment } from "@/backend/env/runtime";
import { noStoreHeaders } from "@/backend/security/response-headers";
import { requireSession } from "@/backend/auth/session/require-session";
import { RegenerateBackupCodesService } from "@/backend/services/profile/regenerate-backup-codes";
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
  )
    return Response.json(
      { message: "Request rejected." },
      { status: 403, headers: noStoreHeaders },
    );
  const parsed = twoFactorManagementSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { message: "Verification could not be completed." },
      { status: 400, headers: noStoreHeaders },
    );
  const subject = `user:${current.userId}`,
    result = await new RegenerateBackupCodesService().execute(
      parsed.data.currentPassword,
      parsed.data.code,
      { headers: request.headers, subject },
    );
  if (!result.ok) {
    const headers = new Headers(noStoreHeaders);
    if (result.status === 429 && result.retryAfterSeconds) {
      headers.set("Retry-After", String(result.retryAfterSeconds));
    }
    return Response.json(
      {
        message:
          result.status === 429
            ? "Too many attempts. Please wait before trying again."
            : result.status === 502
              ? "Two-factor management is temporarily unavailable. Please try again."
              : "Verification could not be completed.",
      },
      { status: result.status, headers },
    );
  }
  return Response.json(
    { backupCodes: result.backupCodes },
    { headers: noStoreHeaders },
  );
}
