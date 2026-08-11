import "server-only";
import { prisma } from "@/backend/database/prisma";
import { requireSession } from "@/backend/auth/session/require-session";
import { validCsrfProof } from "@/backend/security/csrf/csrf-proof";
import { configuredOrigins } from "@/backend/admin/origins";
import { recordAdminAccessDenied } from "@/backend/admin/authorization/admin-access-audit";

export type AdminAuthority = {
  userId: string;
  sessionId: string;
  grantId: string;
  proofAt: Date;
};

export class AdminBoundaryError extends Error {
  constructor(
    public readonly status: 401 | 403,
    public readonly code: "UNAUTHORIZED" | "STEP_UP_REQUIRED",
  ) {
    super(code);
  }
}

function exactRequestOrigin(request: Request, expectedOrigin: string) {
  const url = new URL(request.url);
  const expected = new URL(expectedOrigin);
  const host = request.headers.get("host") ?? url.host;
  if (host.toLowerCase() !== expected.host.toLowerCase()) return false;
  const suppliedOrigin = request.headers.get("origin");
  if (request.method === "GET" || request.method === "HEAD") {
    return suppliedOrigin === null || suppliedOrigin === expected.origin;
  }
  return (
    suppliedOrigin === expected.origin &&
    request.headers.get("sec-fetch-site") === "same-origin"
  );
}

export class AdminRequestBoundary {
  async require(
    request: Request,
    options: { sensitive?: boolean; now?: Date } = {},
  ): Promise<AdminAuthority> {
    const now = options.now ?? new Date();
    if (!exactRequestOrigin(request, configuredOrigins().admin)) {
      await recordAdminAccessDenied(request, "origin_or_fetch_metadata").catch(() => undefined);
      throw new AdminBoundaryError(403, "UNAUTHORIZED");
    }
    const session = await requireSession(request.headers, now);
    if (!session) {
      await recordAdminAccessDenied(request, "session_unavailable").catch(() => undefined);
      throw new AdminBoundaryError(401, "UNAUTHORIZED");
    }
    if (
      !["GET", "HEAD"].includes(request.method) &&
      !validCsrfProof(session.sessionId, request.headers.get("x-csrf-token"))
    ) {
      await recordAdminAccessDenied(request, "csrf_invalid", session.userId).catch(() => undefined);
      throw new AdminBoundaryError(403, "UNAUTHORIZED");
    }
    const grant = await prisma.platformAdministratorGrant.findFirst({
      where: {
        userId: session.userId,
        state: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { sessionPolicy: true },
    });
    const policy = grant?.sessionPolicy;
    if (
      !grant ||
      !policy ||
      policy.designatedSessionId !== session.sessionId ||
      !policy.initialTwoFactorAt ||
      !policy.latestTwoFactorProofAt
    ) {
      await recordAdminAccessDenied(request, "authority_unavailable", session.userId).catch(() => undefined);
      throw new AdminBoundaryError(403, "UNAUTHORIZED");
    }
    if (
      options.sensitive &&
      now.getTime() - policy.latestTwoFactorProofAt.getTime() > 15 * 60_000
    ) {
      await recordAdminAccessDenied(request, "step_up_stale", session.userId).catch(() => undefined);
      throw new AdminBoundaryError(403, "STEP_UP_REQUIRED");
    }
    return {
      userId: session.userId,
      sessionId: session.sessionId,
      grantId: grant.id,
      proofAt: policy.latestTwoFactorProofAt,
    };
  }
}
