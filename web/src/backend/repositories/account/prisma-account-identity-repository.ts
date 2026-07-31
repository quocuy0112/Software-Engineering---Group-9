import "server-only";
import { prisma } from "@/backend/database/prisma";

export type OwnedAccountIdentityRow = {
  name: string;
  email: string;
  emailVerified: boolean;
  state: "ACTIVE";
  createdAt: Date;
  pendingEmailChange: {
    proposedEmail: string;
    expiresAt: Date;
  } | null;
};

export class PrismaAccountIdentityRepository {
  async findOwned(
    userId: string,
    now = new Date(),
  ): Promise<OwnedAccountIdentityRow | null> {
    return prisma.$transaction(async (tx) => {
      await tx.emailChangeRequest.updateMany({
        where: {
          userId,
          status: "PENDING",
          expiresAt: { lte: now },
        },
        data: { status: "EXPIRED", resolvedAt: now },
      });
      const account = await tx.userAccount.findFirst({
        where: { id: userId, state: "ACTIVE", deletedAt: null },
        select: {
          name: true,
          email: true,
          emailVerified: true,
          state: true,
          createdAt: true,
          emailChangeRequests: {
            where: { status: "PENDING", expiresAt: { gt: now } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              proposedEmail: true,
              expiresAt: true,
            },
          },
        },
      });
      if (!account || account.state !== "ACTIVE") return null;
      const pending = account.emailChangeRequests[0];
      return {
        name: account.name,
        email: account.email,
        emailVerified: account.emailVerified,
        state: account.state,
        createdAt: account.createdAt,
        pendingEmailChange: pending
          ? {
              proposedEmail: pending.proposedEmail,
              expiresAt: pending.expiresAt,
            }
          : null,
      };
    });
  }

  async updateOwnedName(userId: string, name: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "user"
        WHERE "id" = ${userId} AND "state" = 'ACTIVE' AND "deletedAt" IS NULL
        FOR UPDATE
      `;
      if (locked.length !== 1) return false;
      const changed = await tx.userAccount.updateMany({
        where: { id: userId, state: "ACTIVE", deletedAt: null },
        data: { name },
      });
      return changed.count === 1;
    });
  }
}
