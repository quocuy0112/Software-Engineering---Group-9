import { twoFactorManagementSchema } from "@/features/identity/schemas/two-factor";
import { validateSameOrigin } from "@/lib/security/csrf";
import { validCsrfProof } from "@/lib/security/csrf-proof";
import { serverEnvironment } from "@/lib/env/runtime";
import { noStoreHeaders } from "@/lib/security/response-headers";
import { requireSession } from "@/server/auth/require-session";
import { RegenerateBackupCodesService } from "@/server/services/identity/regenerate-backup-codes";
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
  const subject =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
    result = await new RegenerateBackupCodesService().execute(
      parsed.data.currentPassword,
      parsed.data.code,
      { headers: request.headers, subject },
    );
  if (!result.ok)
    return Response.json(
      { message: "Verification could not be completed." },
      { status: result.status, headers: noStoreHeaders },
    );
  return Response.json(
    { backupCodes: result.backupCodes },
    { headers: noStoreHeaders },
  );
}
