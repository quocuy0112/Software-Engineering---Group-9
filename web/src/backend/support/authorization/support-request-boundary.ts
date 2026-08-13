import "server-only";
import { requireSession } from "@/backend/auth/session/require-session";
import { configuredOrigins } from "@/backend/admin/origins";
import { validCsrfProof } from "@/backend/security/csrf/csrf-proof";
import { SupportError } from "../support-errors";

export type SupportActor = { userId: string; sessionId: string };

function exactCandidateRequest(request: Request) {
  const expected = new URL(configuredOrigins().candidate);
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const origin = request.headers.get("origin");
  const safeRead = request.method === "GET" || request.method === "HEAD";
  return (
    host.toLowerCase() === expected.host.toLowerCase() &&
    (safeRead
      ? origin === null || origin === expected.origin
      : origin === expected.origin)
  );
}

export class SupportRequestBoundary {
  async requireHttp(request: Request): Promise<SupportActor> {
    if (!exactCandidateRequest(request))
      throw new SupportError("AUTH_REQUIRED", 403);
    const actor = await requireSession(request.headers);
    if (!actor) throw new SupportError("AUTH_REQUIRED", 401);
    if (
      !["GET", "HEAD"].includes(request.method) &&
      !validCsrfProof(
        actor.sessionId,
        request.headers.get("x-csrf-proof") ??
          request.headers.get("x-csrf-token"),
      )
    ) {
      throw new SupportError("AUTH_REQUIRED", 403);
    }
    return actor;
  }

  async requireSocket(headers: Headers): Promise<SupportActor> {
    const expected = new URL(configuredOrigins().candidate);
    if (
      (headers.get("origin") ?? "") !== expected.origin ||
      (headers.get("host") ?? "").toLowerCase() !== expected.host.toLowerCase()
    ) {
      throw new SupportError("AUTH_REQUIRED", 401);
    }
    const actor = await requireSession(headers);
    if (!actor) throw new SupportError("AUTH_REQUIRED", 401);
    return actor;
  }
}
