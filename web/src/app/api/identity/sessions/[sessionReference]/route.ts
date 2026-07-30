import { sessionReferenceSchema } from "@/shared/contracts/identity/session";
import { validateSameOrigin } from "@/backend/security/csrf/csrf";
import { validCsrfProof } from "@/backend/security/csrf/csrf-proof";
import { serverEnvironment } from "@/backend/env/runtime";
import { requireSession } from "@/backend/auth/session/require-session";
import { RevokeSessionService } from "@/backend/services/session/revoke-session";
import { noStoreHeaders } from "@/backend/security/response-headers";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionReference: string }> },
) {
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
  const parsed = sessionReferenceSchema.safeParse(
    (await params).sessionReference,
  );
  if (!parsed.success)
    return Response.json(
      { message: "Invalid session reference." },
      { status: 400, headers: noStoreHeaders },
    );
  await new RevokeSessionService().execute(
    parsed.data,
    current.userId,
    request.headers,
  );
  return Response.json(
    { message: "Session revoked." },
    { headers: noStoreHeaders },
  );
}
