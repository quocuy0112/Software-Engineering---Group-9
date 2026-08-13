import "server-only";
import { requireSession } from "@/backend/auth/session/require-session";
import { configuredOrigins } from "@/backend/admin/origins";
import { validCsrfProof } from "@/backend/security/csrf/csrf-proof";
import { MessagingError } from "@/backend/messaging/messaging-errors";

export type MessagingActor = { userId: string; sessionId: string };

function exactCandidateOrigin(headers: Headers, requestUrl?: string) {
  const expected = new URL(configuredOrigins().candidate);
  const suppliedOrigin = headers.get("origin");
  const suppliedHost = headers.get("host") ?? (requestUrl ? new URL(requestUrl).host : "");
  return (
    suppliedHost.toLowerCase() === expected.host.toLowerCase() &&
    suppliedOrigin === expected.origin
  );
}

export class MessagingRequestBoundary {
  async requireHttp(request: Request): Promise<MessagingActor> {
    const safeRead = request.method === "GET" || request.method === "HEAD";
    const expected = new URL(configuredOrigins().candidate);
    const suppliedOrigin = request.headers.get("origin");
    const suppliedHost = request.headers.get("host") ?? new URL(request.url).host;
    if (
      suppliedHost.toLowerCase() !== expected.host.toLowerCase() ||
      (!safeRead && suppliedOrigin !== expected.origin) ||
      (safeRead && suppliedOrigin !== null && suppliedOrigin !== expected.origin)
    ) {
      throw new MessagingError("AUTH_REQUIRED", 403);
    }
    const actor = await requireSession(request.headers);
    if (!actor) throw new MessagingError("AUTH_REQUIRED", 401);
    if (
      !safeRead &&
      !validCsrfProof(
        actor.sessionId,
        request.headers.get("x-csrf-proof") ??
          request.headers.get("x-csrf-token"),
      )
    ) {
      throw new MessagingError("AUTH_REQUIRED", 403);
    }
    return actor;
  }

  async requireSocket(headers: Headers): Promise<MessagingActor> {
    if (!exactCandidateOrigin(headers)) {
      throw new MessagingError("AUTH_REQUIRED", 401);
    }
    const actor = await requireSession(headers);
    if (!actor) throw new MessagingError("AUTH_REQUIRED", 401);
    return actor;
  }
}
