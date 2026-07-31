import "server-only";
import { prisma } from "@/backend/database/prisma";

export const profileAggregateInclude = {
  experiences: { orderBy: { position: "asc" as const } },
  education: { orderBy: { position: "asc" as const } },
  skills: {
    orderBy: { position: "asc" as const },
    include: { skill: true },
  },
  socialLinks: { orderBy: { position: "asc" as const } },
  candidate: { include: { user: true } },
} as const;

export class PrismaProfileQueryRepository {
  async findOwned(userId: string) {
    return prisma.candidateProfile.findFirst({
      where: {
        candidateUserId: userId,
        candidate: { user: { state: "ACTIVE" } },
      },
      include: profileAggregateInclude,
    });
  }
}
