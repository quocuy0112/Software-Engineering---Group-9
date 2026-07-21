import "server-only";
import { randomUUID } from "node:crypto";
import { verifyPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db/prisma";
import { rateLimitPolicies, safeRetryMetadata } from "@/lib/rate-limit/policies";
import { PrismaRateLimitRepository } from "@/server/repositories/rate-limit/prisma-rate-limit-repository";
import { PrismaAuditRepository } from "@/server/repositories/audit/prisma-audit-repository";
import { requireSession } from "@/server/auth/require-session";

/** Sensitive actions require re-proof no older than ten minutes. */
export const RECENT_AUTH_WINDOW_MS = 10 * 60 * 1000;
export const RECENT_AUTH_ERROR = "Please confirm your current password to continue.";

export type RecentAuthDenied = { ok: false; status: 401 | 429; retryAfterSeconds?: number };
export type RecentAuthGranted = { ok: true; userId: string; sessionId: string };
export type RecentAuthResult = RecentAuthDenied | RecentAuthGranted;

type Dependencies = {
  limiter?: PrismaRateLimitRepository;
  audit?: PrismaAuditRepository;
};

/**
 * Confirms the caller recently authenticated before a sensitive action:
 *  - valid Better Auth session (policy-enforced, ACTIVE-only),
 *  - the owning UserAccount is ACTIVE,
 *  - the session was established within the recent-auth window,
 *  - the supplied current password verifies through Better Auth only.
 * Failures are generic and never leak which check failed. No password value is logged.
 */
export class RequireRecentAuthService {
  private readonly limiter: PrismaRateLimitRepository;
  private readonly audit: PrismaAuditRepository;

  constructor(dependencies: Dependencies = {}) {
    this.limiter = dependencies.limiter ?? new PrismaRateLimitRepository();
    this.audit = dependencies.audit ?? new PrismaAuditRepository();
  }

  async execute(
    currentPassword: string,
    request: { headers: Headers; subject: string; now?: Date },
  ): Promise<RecentAuthResult> {
    const now = request.now ?? new Date();
    const correlationId = randomUUID();

    const decision = await this.limiter.consume({
      ...rateLimitPolicies.totpEnrollment,
      subject: `recent-auth:${request.subject}`,
      now,
    });
    if (!decision.allowed) {
      await this.record("DENIED", correlationId, now, "throttled");
      return { ok: false, status: 429, retryAfterSeconds: safeRetryMetadata(decision).retryAfterSeconds };
    }

    const session = await requireSession(request.headers, now);
    if (!session) {
      await this.record("FAILURE", correlationId, now, "no_session");
      return { ok: false, status: 401 };
    }

    const account = await prisma.userAccount.findUnique({
      where: { id: session.userId },
      select: { state: true },
    });
    if (account?.state !== "ACTIVE") {
      await this.record("FAILURE", correlationId, now, "inactive", session.userId, session.sessionId);
      return { ok: false, status: 401 };
    }

    const sessionRow = await prisma.session.findFirst({
      where: { id: session.sessionId, userId: session.userId },
      select: { createdAt: true },
    });
    if (!sessionRow || sessionRow.createdAt.getTime() + RECENT_AUTH_WINDOW_MS <= now.getTime()) {
      await this.record("FAILURE", correlationId, now, "stale", session.userId, session.sessionId);
      return { ok: false, status: 401 };
    }

    const credential = await prisma.authProviderAccount.findFirst({
      where: { userId: session.userId, providerId: "credential" },
      select: { password: true },
    });
    const verified = credential?.password
      ? await verifyPassword({ hash: credential.password, password: currentPassword }).catch(() => false)
      : false;
    if (!verified) {
      await this.record("FAILURE", correlationId, now, "wrong_password", session.userId, session.sessionId);
      return { ok: false, status: 401 };
    }

    return { ok: true, userId: session.userId, sessionId: session.sessionId };
  }

  private record(
    result: "SUCCESS" | "FAILURE" | "DENIED",
    correlationId: string,
    occurredAt: Date,
    reason: string,
    actorUserId?: string,
    actorSessionId?: string,
  ) {
    return this.audit
      .append({
        occurredAt,
        actorType: actorUserId ? "user" : "anonymous",
        actorUserId: actorUserId ?? null,
        actorSessionId: actorSessionId ?? null,
        action: "login.failed",
        targetType: "user_account",
        targetId: actorUserId ?? null,
        result,
        correlationId,
        context: { stage: "recent_auth", reason },
      })
      .catch(() => undefined);
  }
}
