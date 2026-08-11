import "server-only";
import { prisma } from "@/backend/database/prisma";
import { requireSession } from "@/backend/auth/session/require-session";
import { recruiterEntitlementSchema } from "@/shared/contracts/admin/recruiter-entitlement";

const destinations = [
  { label: "Candidate Dashboard" as const, href: "/dashboard" },
  {
    label: "Employer Verification" as const,
    href: "/dashboard/employer-verification",
  },
];
export class RecruiterEntitlementService {
  async resolve(request: Request, selectedCompanyId?: string) {
    const session = await requireSession(request.headers, new Date());
    if (!session)
      return recruiterEntitlementSchema.parse({
        available: false,
        requiresSelection: false,
        selectedCompanyId: null,
        companies: [],
        destinations,
      });
    const account = await prisma.userAccount.findFirst({
      where: { id: session.userId, state: "ACTIVE" },
      select: {
        companyMemberships: {
          where: { status: "ACTIVE", company: { verificationState: "ACTIVE" } },
          select: {
            id: true,
            companyId: true,
            role: true,
            version: true,
            company: { select: { displayName: true } },
          },
          orderBy: [{ company: { displayName: "asc" } }, { companyId: "asc" }],
        },
      },
    });
    const companies =
      account?.companyMemberships.map((row) => ({
        companyId: row.companyId,
        companyName: row.company.displayName,
        membershipId: row.id,
        role: row.role,
        membershipVersion: row.version,
      })) ?? [];
    const selected =
      selectedCompanyId &&
      companies.some((row) => row.companyId === selectedCompanyId)
        ? selectedCompanyId
        : companies.length === 1
          ? companies[0]!.companyId
          : null;
    return recruiterEntitlementSchema.parse({
      available: Boolean(selected),
      requiresSelection: companies.length > 1 && !selected,
      selectedCompanyId: selected,
      companies,
      destinations,
    });
  }
}
