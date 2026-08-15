import "server-only";

import { prisma } from "@/backend/database/prisma";

/**
 * Denies and soft-deletes derived evidence after Group 1 document retention
 * expires. Legal holds are checked before each batch; score lineage metadata
 * remains available without exposing CV excerpts or AI narrative text.
 */
export class ScoringRetentionWorker {
  constructor(private readonly db: typeof prisma = prisma) {}

  async run(input: { now?: Date; batchSize?: number } = {}) {
    const now = input.now ?? new Date();
    const batchSize = Math.min(Math.max(input.batchSize ?? 250, 1), 1_000);
    const applications = await this.db.jobApplication.findMany({
      where: {
        documentDeletedAt: { not: null },
        documentDeletionDueAt: { lte: now },
        legalHolds: { none: { startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }], releasedAt: null } },
      },
      take: batchSize,
      select: { id: true },
    });
    if (!applications.length) return { applications: 0, evidence: 0, assessments: 0 };
    const applicationIds = applications.map((application) => application.id);
    return this.db.$transaction(async (tx) => {
      const evidence = await tx.cvEvidenceExcerpt.updateMany({ where: { skillEvidenceExtraction: { automaticMatchResult: { jobApplicationId: { in: applicationIds } } }, deletedAt: null }, data: { accessDeniedAt: now, deletedAt: now, deleteAfter: now } });
      const assessments = await tx.aiAssessment.updateMany({ where: { jobApplicationId: { in: applicationIds }, deletedAt: null }, data: { accessDeniedAt: now, deletedAt: now, deleteAfter: now } });
      return { applications: applications.length, evidence: evidence.count, assessments: assessments.count };
    });
  }
}
