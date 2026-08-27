import "server-only";

import { prisma } from "@/backend/database/prisma";

const publicCompanyWhere = {
  verifiedAt: { not: null },
  verificationState: "ACTIVE" as const,
  verificationInactiveAt: null,
  moderationState: "ACTIVE" as const,
};

const publicCompanySelect = {
  id: true,
  slug: true,
  displayName: true,
  logoUrl: true,
  publicDescription: true,
  publicLocation: true,
  foundedYear: true,
  industry: true,
} as const;

export type PublicCompanyRow = Awaited<
  ReturnType<PrismaCompanyDiscoveryRepository["findById"]>
>;

export interface CompanyDiscoveryRepository {
  list(input: { q?: string; page: number; limit: number }): Promise<{
    items: Array<{
      id: string;
      slug: string;
      displayName: string;
      logoUrl: string | null;
      publicDescription: string | null;
    }>;
    total: number;
  }>;
  findById(companyId: string): Promise<{
    id: string;
    slug: string;
    displayName: string;
    logoUrl: string | null;
    publicDescription: string | null;
    publicLocation: string | null;
    foundedYear: number | null;
    industry: string | null;
    activeEmployeeCount: number;
    activeOwnerCount: number;
  } | null>;
}

export class PrismaCompanyDiscoveryRepository implements CompanyDiscoveryRepository {
  async list(input: { q?: string; page: number; limit: number }) {
    const terms = (input.q ?? "").trim().split(/\s+/u).filter(Boolean);
    const where = terms.length
      ? {
          ...publicCompanyWhere,
          AND: terms.map((term) => ({
            OR: [
              { slug: { contains: term, mode: "insensitive" as const } },
              {
                displayName: {
                  contains: term,
                  mode: "insensitive" as const,
                },
              },
              {
                publicDescription: {
                  contains: term,
                  mode: "insensitive" as const,
                },
              },
              {
                publicLocation: {
                  contains: term,
                  mode: "insensitive" as const,
                },
              },
              { industry: { contains: term, mode: "insensitive" as const } },
            ],
          })),
        }
      : publicCompanyWhere;
    const [items, total] = await Promise.all([
      prisma.company.findMany({
        where,
        select: publicCompanySelect,
        orderBy: [{ displayName: "asc" }, { id: "asc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.company.count({ where }),
    ]);
    return { items, total };
  }

  async findById(companyId: string) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, ...publicCompanyWhere },
      select: publicCompanySelect,
    });
    if (!company) return null;
    const [activeEmployeeCount, activeOwnerCount] = await Promise.all([
      prisma.companyMembership.count({
        where: {
          companyId: company.id,
          status: "ACTIVE",
          removedAt: null,
        },
      }),
      prisma.companyMembership.count({
        where: {
          companyId: company.id,
          role: "OWNER",
          status: "ACTIVE",
          removedAt: null,
        },
      }),
    ]);
    return { ...company, activeEmployeeCount, activeOwnerCount };
  }
}

export { publicCompanyWhere };
