import "server-only";
import type { Prisma, PrismaClient } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";

type NotificationDb = PrismaClient | Prisma.TransactionClient;

export class NotificationRecipientPolicy {
  constructor(private readonly db: NotificationDb = prisma) {}

  async activeCompanyRecipients(companyId: string) {
    const memberships = await this.db.companyMembership.findMany({
      where: {
        companyId,
        status: "ACTIVE",
        role: { in: ["OWNER", "HR_MANAGER", "RECRUITER", "HIRING_MANAGER"] },
        user: { state: "ACTIVE" },
      },
      select: { userId: true },
    });
    return [...new Set(memberships.map((membership) => membership.userId))];
  }

  async activeAdministratorRecipients(
    now: Date,
    preferredRecipientUserId?: string | null,
  ) {
    const activeWhere = {
      state: "ACTIVE" as const,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      user: { state: "ACTIVE" as const, deletedAt: null },
    };
    if (preferredRecipientUserId) {
      const preferred = await this.db.platformAdministratorGrant.findFirst({
        where: { ...activeWhere, userId: preferredRecipientUserId },
        select: { userId: true },
      });
      if (preferred) return [preferred.userId];
    }
    const administrators = await this.db.platformAdministratorGrant.findMany({
      where: activeWhere,
      select: { userId: true },
      orderBy: { userId: "asc" },
    });
    return [...new Set(administrators.map(({ userId }) => userId))];
  }

  async otherConversationParticipant(conversationId: string, senderId: string) {
    const participant =
      await this.db.messagingConversationParticipant.findFirst({
        where: {
          conversationId,
          userId: { not: senderId },
        },
        select: { userId: true, lastReadSequence: true },
      });
    return participant ?? null;
  }
}
