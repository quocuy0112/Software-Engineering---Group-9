import "server-only";

import { prisma } from "@/backend/database/prisma";

const opportunitySelect = {
  id: true,
  companyId: true,
  role: true,
  state: true,
  closedAt: true,
  createdAt: true,
} as const;

export type TeamOpportunityRow = Awaited<
  ReturnType<PrismaTeamOpportunityRepository["listForCompany"]>
>[number];

export interface TeamOpportunityRepositoryPort {
  listForCompany(companyId: string): Promise<readonly TeamOpportunityRow[]>;
  findForCompanyRole(
    companyId: string,
    role: "HR_MANAGER" | "RECRUITER",
  ): ReturnType<PrismaTeamOpportunityRepository["findForCompanyRole"]>;
}

export class PrismaTeamOpportunityRepository implements TeamOpportunityRepositoryPort {
  listForCompany(companyId: string) {
    return prisma.teamOpportunity.findMany({
      where: { companyId },
      select: opportunitySelect,
      orderBy: { role: "asc" },
    });
  }

  findForCompanyRole(companyId: string, role: "HR_MANAGER" | "RECRUITER") {
    return prisma.teamOpportunity.findUnique({
      where: { companyId_role: { companyId, role } },
      select: opportunitySelect,
    });
  }
}

export { opportunitySelect };
