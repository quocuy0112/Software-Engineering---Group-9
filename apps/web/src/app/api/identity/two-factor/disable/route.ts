import { twoFactorManagementSchema } from "@/features/identity/schemas/two-factor";
import { validateSameOrigin } from "@/lib/security/csrf";
import { validCsrfProof } from "@/lib/security/csrf-proof";
import { serverEnvironment } from "@/lib/env/runtime";
import { noStoreHeaders } from "@/lib/security/response-headers";
import { requireSession } from "@/server/auth/require-session";
import { DisableTwoFactorService } from "@/server/services/identity/disable-two-factor";
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
    result = await new DisableTwoFactorService().execute(
      parsed.data.currentPassword,
      parsed.data.code,
      { headers: request.headers, subject },
    );
  if (!result.ok)
    return Response.json(
      { message: "Verification could not be completed." },
      { status: result.status, headers: noStoreHeaders },
    );
  const headers = new Headers(noStoreHeaders);
  if (result.sessionCookie) headers.append("Set-Cookie", result.sessionCookie);
  return Response.json(
    { message: "Two-factor authentication disabled." },
    { headers },
  );
}
