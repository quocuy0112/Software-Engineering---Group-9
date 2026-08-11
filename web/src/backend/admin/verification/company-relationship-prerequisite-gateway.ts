import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
export class CompanyRelationshipPrerequisiteGateway {
  async require(
    tx: Prisma.TransactionClient,
    input: {
      prerequisiteId?: string;
      applicantUserId: string;
      companyId: string;
      requestedRole: "OWNER" | "HR_MANAGER" | "RECRUITER" | "HIRING_MANAGER";
      requestId?: string;
      now: Date;
    },
  ) {
    if (process.env.ADMIN_COMPANY_PREREQUISITE_READY !== "true")
      throw new Error("PREREQUISITE_INTEGRATION_UNAVAILABLE");
    if (!input.prerequisiteId) throw new Error("RELATIONSHIP_REQUIRED");
    const row = await tx.companyAccessPrerequisite.findFirst({
      where: {
        id: input.prerequisiteId,
        applicantUserId: input.applicantUserId,
        companyId: input.companyId,
        role: input.requestedRole,
        state: "AVAILABLE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: input.now } }],
      },
    });
    if (!row) throw new Error("RELATIONSHIP_REQUIRED");
    return row;
  }
}
