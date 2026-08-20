import "server-only";

import { prisma } from "@/backend/database/prisma";
import type { Prisma } from "@/backend/generated/prisma/client";

type Database = typeof prisma | Prisma.TransactionClient;

export type ActivityRetentionCandidate = Readonly<{
  id: string;
  occurredAt: Date;
  correlationId: string;
  targetType: string;
  targetId: string | null;
}>;

export type ActivityLegalHoldRow = Readonly<{
  id: string;
  scopeType: string;
  scopeReference: string;
  startsAt: Date;
  endsAt: Date;
  releasedAt: Date | null;
}>;

export class PrismaActivityRetentionRepository {
  constructor(private readonly db: Database = prisma) {}

  findExpiredCandidates(before: Date, take: number) {
    return this.db.auditEvent.findMany({
      where: { occurredAt: { lt: before } },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      take,
      select: {
        id: true,
        occurredAt: true,
        correlationId: true,
        targetType: true,
        targetId: true,
      },
    });
  }

  activeLegalHolds(now: Date) {
    return this.db.activityLegalHold.findMany({
      where: {
        startsAt: { lte: now },
        endsAt: { gt: now },
        releasedAt: null,
      },
      select: {
        id: true,
        scopeType: true,
        scopeReference: true,
        startsAt: true,
        endsAt: true,
        releasedAt: true,
      },
    });
  }

  deleteAuditEvents(ids: readonly string[]) {
    if (!ids.length) return Promise.resolve({ count: 0 });
    return this.db.auditEvent.deleteMany({ where: { id: { in: [...ids] } } });
  }

  createLegalHold(input: {
    scopeType: string;
    scopeReference: string;
    reasonCategory: string;
    authorizedByAdminUserId: string;
    startsAt: Date;
    endsAt: Date;
    correlationId: string;
  }) {
    return this.db.activityLegalHold.create({ data: input });
  }

  releaseLegalHold(id: string, releasedAt: Date) {
    return this.db.activityLegalHold.updateMany({
      where: { id, releasedAt: null },
      data: { releasedAt },
    });
  }
}
