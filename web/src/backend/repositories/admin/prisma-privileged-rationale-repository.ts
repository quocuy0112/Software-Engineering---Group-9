import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import { prisma } from "@/backend/database/prisma";

type Client = Pick<typeof prisma, "privilegedActionRationale"> | Prisma.TransactionClient;

export class PrismaPrivilegedRationaleRepository {
  constructor(private readonly db: Client = prisma) {}

  create(data: Prisma.PrivilegedActionRationaleUncheckedCreateInput) {
    return this.db.privilegedActionRationale.create({ data });
  }

  findAvailable(correlationId: string, now: Date) {
    return this.db.privilegedActionRationale.findFirst({
      where: { correlationId, inaccessibleAt: { gt: now }, deletedAt: null },
    });
  }

  claimDue(now: Date, limit = 50) {
    return this.db.privilegedActionRationale.findMany({
      where: { deleteAfter: { lte: now }, deletedAt: null },
      orderBy: [{ deleteAfter: "asc" }, { id: "asc" }],
      take: limit,
    });
  }
}
