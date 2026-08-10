import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";

type Client = Pick<
  typeof prisma,
  "platformAdministratorGrant" | "administratorSessionPolicy" | "session"
> | Prisma.TransactionClient;

export class PrismaAdminAuthorityRepository {
  constructor(private readonly db: Client = prisma) {}

  activeGrantForUser(userId: string, now: Date) {
    return this.db.platformAdministratorGrant.findFirst({
      where: {
        userId,
        state: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { sessionPolicy: true },
    });
  }

  sessionForUser(sessionId: string, userId: string, now: Date) {
    return this.db.session.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
      },
    });
  }
}
