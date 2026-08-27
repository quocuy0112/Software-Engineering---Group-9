import "server-only";

import { prisma } from "@/backend/database/prisma";

const invitationSelect = {
  id: true,
  state: true,
  expiresAt: true,
} as const;

const candidateSelect = {
  id: true,
  companyId: true,
  appliedRole: true,
  status: true,
  applicationEmail: true,
  submittedAt: true,
  ownerFirstViewedAt: true,
  decidedAt: true,
  joinedAt: true,
  company: { select: { displayName: true, slug: true } },
  invitation: { select: invitationSelect },
} as const;

const ownerSelect = {
  ...candidateSelect,
  cvDisplayName: true,
  cvFileName: true,
  cvMimeType: true,
  cvByteSize: true,
  rejectionReason: true,
  candidate: { select: { user: { select: { name: true } } } },
} as const;

export type CandidateTeamApplicationRow = Awaited<
  ReturnType<PrismaTeamApplicationRepository["findForCandidate"]>
>;
export type OwnerTeamApplicationRow = Awaited<
  ReturnType<PrismaTeamApplicationRepository["findForOwner"]>
>;

export interface TeamApplicationRepositoryPort {
  listForCandidate(
    userId: string,
  ): ReturnType<PrismaTeamApplicationRepository["listForCandidate"]>;
  findForCandidate(
    userId: string,
    applicationId: string,
  ): ReturnType<PrismaTeamApplicationRepository["findForCandidate"]>;
  listForOwner(
    companyId: string,
  ): ReturnType<PrismaTeamApplicationRepository["listForOwner"]>;
  findForOwner(
    companyId: string,
    applicationId: string,
  ): ReturnType<PrismaTeamApplicationRepository["findForOwner"]>;
}

export class PrismaTeamApplicationRepository implements TeamApplicationRepositoryPort {
  listForCandidate(userId: string) {
    return prisma.teamApplication.findMany({
      where: { candidateUserId: userId },
      select: candidateSelect,
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }

  findForCandidate(userId: string, applicationId: string) {
    return prisma.teamApplication.findFirst({
      where: { id: applicationId, candidateUserId: userId },
      select: candidateSelect,
    });
  }

  listForOwner(companyId: string) {
    return prisma.teamApplication.findMany({
      where: {
        companyId,
        appliedRole: { in: ["HR_MANAGER", "RECRUITER"] },
      },
      select: ownerSelect,
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }

  findForOwner(companyId: string, applicationId: string) {
    return prisma.teamApplication.findFirst({
      where: {
        id: applicationId,
        companyId,
        appliedRole: { in: ["HR_MANAGER", "RECRUITER"] },
      },
      select: ownerSelect,
    });
  }
}

export { candidateSelect, ownerSelect };
