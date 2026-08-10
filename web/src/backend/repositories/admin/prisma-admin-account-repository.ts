import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";
import {
  projectAdminSession,
  adminSessionReference,
} from "@/backend/admin/accounts/admin-session-projector";
import { maskEmail } from "@/backend/admin/accounts/account-list-service";

type Client = typeof prisma | Prisma.TransactionClient;
export class PrismaAdminAccountRepository {
  constructor(private readonly db: Client = prisma) {}
  async security(accountId: string, now = new Date()) {
    const account = await this.db.userAccount.findUnique({
      where: { id: accountId },
      include: {
        companyMemberships: {
          where: { status: "ACTIVE" },
          include: {
            company: {
              select: { id: true, legalName: true, verificationState: true },
            },
          },
          orderBy: [{ companyId: "asc" }, { id: "asc" }],
        },
        sessions: {
          where: {
            revokedAt: null,
            expiresAt: { gt: now },
            absoluteExpiresAt: { gt: now },
          },
          orderBy: [{ lastActivityAt: "desc" }, { id: "asc" }],
        },
      },
    });
    if (!account) return null;
    const [notifications, auditEvents] = await Promise.all([
      this.db.securityNotificationWork.findMany({
        where: { targetUserId: accountId },
        orderBy: [{ createdAt: "desc" }],
        take: 20,
      }),
      this.db.auditEvent.findMany({
        where: {
          targetType: "user_account",
          targetId: accountId,
          action: { startsWith: "admin." },
        },
        select: {
          occurredAt: true,
          action: true,
          result: true,
          correlationId: true,
          context: true,
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 20,
      }),
    ]);
    return {
      id: account.id,
      displayName: account.name,
      maskedEmail: maskEmail(account.email),
      state: account.state,
      version: account.version,
      stateChangedAt: account.stateChangedAt.toISOString(),
      createdAt: account.createdAt.toISOString(),
      memberships: account.companyMemberships.map((membership) => ({
        id: membership.id,
        company: membership.company,
        role: membership.role,
        state: membership.status,
      })),
      sessions: account.sessions.map(projectAdminSession),
      notifications: notifications.map(
        ({
          id,
          status,
          kind,
          lastAttemptAt,
          nextAttemptAt,
          failureCategory,
          originatingCorrelationId,
        }) => ({
          id,
          status,
          kind,
          lastAttemptAt: lastAttemptAt?.toISOString() ?? null,
          nextAttemptAt: nextAttemptAt?.toISOString() ?? null,
          failureCategory,
          correlationId: originatingCorrelationId,
        }),
      ),
      auditEvents: auditEvents.map((event) => ({
        ...event,
        occurredAt: event.occurredAt.toISOString(),
      })),
    };
  }
  async resolveSession(accountId: string, reference: string, now = new Date()) {
    const sessions = await this.db.session.findMany({
      where: {
        userId: accountId,
        revokedAt: null,
        expiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
      },
      select: { id: true },
    });
    return (
      sessions.find(
        (session) => adminSessionReference(session.id) === reference,
      )?.id ?? null
    );
  }
}
