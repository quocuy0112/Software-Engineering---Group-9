import { validateSameOrigin } from "@/backend/security/csrf/csrf";
import { validCsrfProof } from "@/backend/security/csrf/csrf-proof";
import { serverEnvironment } from "@/backend/env/runtime";
import { requireSession } from "@/backend/auth/session/require-session";
import { BetterAuthSessionGateway } from "@/backend/auth/better-auth/better-auth-session-gateway";
import { SessionService } from "@/backend/services/session/session-service";
import { noStoreHeaders } from "@/backend/security/response-headers";
export async function POST(request: Request) {
  const current = await requireSession(request.headers);
  if (!current)
    return Response.json({ message: "Signed out." }, { headers: noStoreHeaders });
  if (
    !validateSameOrigin(request, serverEnvironment.NEXT_PUBLIC_APP_URL) ||
    !validCsrfProof(current.sessionId, request.headers.get("x-csrf-token"))
  )
    return Response.json(
      { message: "Request rejected." },
      { status: 403, headers: noStoreHeaders },
    );
  const upstream = await new BetterAuthSessionGateway().signOut(
    request.headers,
  );
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  for (const cookie of upstream.headers.getSetCookie())
    headers.append("Set-Cookie", cookie);
  await new SessionService().recordLogout(current.userId, current.sessionId);
  return new Response(JSON.stringify({ message: "Signed out." }), { headers });
}
