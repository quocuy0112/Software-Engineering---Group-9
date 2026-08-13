import "server-only";
import { requireSession } from "@/backend/auth/session/require-session";
import { configuredOrigins } from "@/backend/admin/origins";
import { validCsrfProof } from "@/backend/security/csrf/csrf-proof";
import { ConnectionError } from "../connection-errors";

export type ConnectionActor = { userId: string; sessionId: string };

export class ConnectionRequestBoundary {
  async requireHttp(request: Request): Promise<ConnectionActor> {
    const safeRead = request.method === "GET" || request.method === "HEAD";
    const expected = new URL(configuredOrigins().candidate);
    const url = new URL(request.url);
    const host = request.headers.get("host") ?? url.host;
    const origin = request.headers.get("origin");
    if (
      host.toLowerCase() !== expected.host.toLowerCase() ||
      (!safeRead && origin !== expected.origin) ||
      (safeRead && origin !== null && origin !== expected.origin)
    ) {
      throw new ConnectionError("AUTH_REQUIRED", 403);
    }
    const actor = await requireSession(request.headers);
    if (!actor) throw new ConnectionError("AUTH_REQUIRED", 401);
    if (
      !safeRead &&
      !validCsrfProof(
        actor.sessionId,
        request.headers.get("x-csrf-proof") ??
          request.headers.get("x-csrf-token"),
      )
    ) {
      throw new ConnectionError("AUTH_REQUIRED", 403);
    }
    return actor;
  }

  async requireSocket(headers: Headers): Promise<ConnectionActor> {
    const expected = new URL(configuredOrigins().candidate);
    if (headers.get("origin") !== expected.origin) {
      throw new ConnectionError("AUTH_REQUIRED", 401);
    }
    const actor = await requireSession(headers);
    if (!actor) throw new ConnectionError("AUTH_REQUIRED", 401);
    return actor;
  }
}
