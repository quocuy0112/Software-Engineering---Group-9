import { sessionReferenceSchema } from "@/features/identity/schemas/session";
import { validateSameOrigin } from "@/lib/security/csrf";
import { validCsrfProof } from "@/lib/security/csrf-proof";
import { serverEnvironment } from "@/lib/env/runtime";
import { requireSession } from "@/server/auth/require-session";
import { RevokeSessionService } from "@/server/services/identity/revoke-session";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionReference: string }> },
) {
  const current = await requireSession(request.headers);
  if (!current)
    return Response.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  if (
    !validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL) ||
    !validCsrfProof(current.sessionId, request.headers.get("x-csrf-token"))
  )
    return Response.json({ message: "Request rejected." }, { status: 403 });
  const parsed = sessionReferenceSchema.safeParse(
    (await params).sessionReference,
  );
  if (!parsed.success)
    return Response.json(
      { message: "Invalid session reference." },
      { status: 400 },
    );
  await new RevokeSessionService().execute(
    parsed.data,
    current.userId,
    request.headers,
  );
  return Response.json({ message: "Session revoked." });
}
