import { validateSameOrigin } from "@/lib/security/csrf";
import { validCsrfProof } from "@/lib/security/csrf-proof";
import { serverEnvironment } from "@/lib/env/runtime";
import { requireSession } from "@/server/auth/require-session";
import { BetterAuthSessionGateway } from "@/server/auth/identity/better-auth-session-gateway";
import { SessionService } from "@/server/services/identity/session-service";
import { noStoreHeaders } from "@/lib/security/response-headers";
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
