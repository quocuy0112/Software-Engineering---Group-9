import "server-only";

import { prisma } from "@/backend/database/prisma";

export type HomePublicCompanyRow = {
  slug: string;
  displayName: string;
  logoUrl: string | null;
  publicDescription: string | null;
  publicLocation: string | null;
  industry: string | null;
  size: string | null;
  openPositionCount: number;
};

export interface HomePublicCompanyRepository {
  list(now: Date, limit: number): Promise<readonly HomePublicCompanyRow[]>;
}

export class PrismaHomePublicCompanyRepository
  implements HomePublicCompanyRepository
{
  async list(now: Date, limit = 6): Promise<readonly HomePublicCompanyRow[]> {
    const rows = await prisma.company.findMany({
      where: {
        verificationState: "ACTIVE",
        verifiedAt: { not: null },
        verificationInactiveAt: null,
      },
      orderBy: [{ verifiedAt: "desc" }, { id: "asc" }],
      take: Math.min(Math.max(limit, 1), 6),
      select: {
        slug: true,
        displayName: true,
        logoUrl: true,
        publicDescription: true,
        publicLocation: true,
        industry: true,
        size: true,
        _count: {
          select: {
            jobPostings: {
              where: {
                status: "ACTIVE",
                approvedAt: { not: null },
                publishedAt: { not: null, lte: now },
                OR: [
                  { applicationDeadline: null },
                  { applicationDeadline: { gt: now } },
                ],
              },
            },
          },
        },
      },
    });
    return rows.map(({ _count, ...company }) => ({
      ...company,
      openPositionCount: _count.jobPostings,
    }));
  }
}
