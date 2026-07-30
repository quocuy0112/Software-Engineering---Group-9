import "server-only";
import { prisma } from "@/backend/database/prisma";
const IDLE_MS = 30 * 60 * 1000;
export class PrismaSessionPolicyRepository {
  async accountByEmail(email: string) {
    return prisma.userAccount.findUnique({
      where: { normalizedEmail: email },
      select: { id: true, state: true, twoFactorEnabled: true },
    });
  }
  async newest(userId: string) {
    return prisma.session.findFirst({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: { id: true },
    });
  }
  async enforceCap(userId: string, keepId?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "user" WHERE "id"=${userId} FOR UPDATE`;
      const sessions = await tx.session.findMany({
        where: { userId, revokedAt: null },
        orderBy: [
          { lastActivityAt: "desc" },
          { createdAt: "desc" },
          { id: "asc" },
        ],
        select: { id: true },
      });
      const others = sessions.filter(({ id }) => id !== keepId);
      const keep = new Set(others.slice(0, keepId ? 4 : 5).map(({ id }) => id));
      if (keepId && sessions.some(({ id }) => id === keepId)) keep.add(keepId);
      const victims = sessions
        .filter(({ id }) => !keep.has(id))
        .map(({ id }) => id);
      if (victims.length)
        await tx.session.deleteMany({ where: { id: { in: victims }, userId } });
      return victims;
    });
  }
  async validateAndTouch(id: string, userId: string, now = new Date()) {
    return prisma.$transaction(async (tx) => {
      const row = await tx.session.findFirst({
        where: { id, userId },
        include: {
          user: {
            select: {
              state: true,
              passwordResetOperations: {
                where: { finalizedAt: null },
                select: { id: true },
                take: 1,
              },
              fullAccountRecoveryOperations: {
                where: { status: { in: ["CONFIRMED_HOLD", "COMPLETING"] } },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      });
      if (!row) return null;
      const expired =
        row.revokedAt !== null ||
        row.expiresAt <= now ||
        row.absoluteExpiresAt <= now ||
        row.lastActivityAt.getTime() + IDLE_MS <= now.getTime() ||
        row.user.state !== "ACTIVE" ||
        row.user.passwordResetOperations.length > 0 ||
        row.user.fullAccountRecoveryOperations.length > 0;
      if (expired) {
        await tx.session.deleteMany({ where: { id, userId } });
        return null;
      }
      await tx.session.update({ where: { id }, data: { lastActivityAt: now } });
      return row;
    });
  }
  async list(userId: string) {
    return prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastActivityAt: "desc" },
      select: {
        id: true,
        token: true,
        ipAddress: true,
        userAgent: true,
        lastActivityAt: true,
        absoluteExpiresAt: true,
      },
    });
  }
  async tokenForOwned(reference: string, userId: string) {
    return (
      (
        await prisma.session.findFirst({
          where: { id: reference, userId },
          select: { token: true },
        })
      )?.token ?? null
    );
  }
}
