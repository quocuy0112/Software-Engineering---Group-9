import "server-only";
import { prisma } from "@/backend/database/prisma";

export class AdminAuditQueryService {
  byCorrelation(correlationId: string) {
    return prisma.auditEvent.findMany({
      where: { correlationId },
      select: {
        occurredAt: true,
        action: true,
        targetType: true,
        targetId: true,
        result: true,
        correlationId: true,
        context: true,
      },
      orderBy: [{ occurredAt: "asc" as const }, { id: "asc" as const }],
    });
  }
}
