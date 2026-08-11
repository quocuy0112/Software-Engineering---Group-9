import "server-only";

import { prisma } from "@/backend/database/prisma";
import type { RecruiterHeaderStatusRepositoryPort } from "@/backend/recruiter-header/recruiter-header-status-repository";

export class PrismaRecruiterHeaderStatusRepository implements RecruiterHeaderStatusRepositoryPort {
  constructor(private readonly client = prisma) {}

  async hasQualifyingMembership(userId: string) {
    const membership = await this.client.companyMembership.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        company: {
          verificationState: "ACTIVE",
          verifiedAt: { not: null },
        },
      },
      select: { id: true },
    });
    return Boolean(membership);
  }

  async findLatestVerificationState(userId: string) {
    const request = await this.client.recruiterVerificationRequest.findFirst({
      where: { applicantUserId: userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { state: true },
    });
    return request?.state ?? null;
  }
}
