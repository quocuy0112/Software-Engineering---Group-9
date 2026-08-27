import "server-only";

import { PrismaCompanyDiscoveryRepository } from "@/backend/repositories/companies/prisma-company-discovery-repository";

export class CompanyDiscoveryAuthorizationError extends Error {
  constructor(readonly code: "COMPANY_UNAVAILABLE") {
    super(code);
  }
}

/**
 * Public company access is deliberately an allow-list projection. Callers get
 * the same non-sensitive error for an unknown, unapproved, moderated, or
 * inactive company so private state cannot be probed by identifier.
 */
export async function requirePublicCompany(companyId: string) {
  const company = await new PrismaCompanyDiscoveryRepository().findById(
    companyId,
  );
  if (!company) {
    throw new CompanyDiscoveryAuthorizationError("COMPANY_UNAVAILABLE");
  }
  return company;
}
