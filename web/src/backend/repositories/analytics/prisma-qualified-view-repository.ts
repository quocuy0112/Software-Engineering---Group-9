import "server-only";

import { prisma } from "@/backend/database/prisma";

export class PrismaQualifiedViewRepository {
  constructor(private readonly db: typeof prisma = prisma) {}

  async admit(input: {
    jobPostingId: string;
    companyId: string;
    occurredAt: Date;
    platformDay: Date;
    visitorDayDigest: string;
    digestVersion: number;
    qualificationPolicyVersion: string;
  }) {
    try {
      await this.db.jobPostingViewFact.create({
        data: {
          jobPostingId: input.jobPostingId,
          companyId: input.companyId,
          occurredAt: input.occurredAt,
          platformDay: input.platformDay,
          visitorDayDigest: input.visitorDayDigest,
          digestVersion: input.digestVersion,
          qualification: "QUALIFIED",
          qualificationPolicyVersion: input.qualificationPolicyVersion,
        },
      });
      return true;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return false;
      }
      throw error;
    }
  }

  count(input: { jobPostingId: string; from: Date; to: Date }) {
    return this.db.jobPostingViewFact.count({
      where: {
        jobPostingId: input.jobPostingId,
        qualification: "QUALIFIED",
        occurredAt: { gte: input.from, lt: input.to },
      },
    });
  }
}
