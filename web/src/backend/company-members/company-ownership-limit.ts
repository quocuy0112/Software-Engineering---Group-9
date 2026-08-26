import "server-only";
import type { Prisma } from "@/backend/generated/prisma/client";
import {
  isOwnerCompanyRole,
  MAX_OWNED_COMPANIES_PER_USER,
  OWNER_COMPANY_LIMIT_REACHED,
} from "@/shared/contracts/company-ownership";

export async function countActiveOwnedCompanies(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  return tx.companyMembership.count({
    where: {
      userId,
      role: "OWNER",
      status: "ACTIVE",
    },
  });
}

/**
 * The caller must hold the applicant/user row lock when this is used as an
 * admission decision. Verification approval already acquires that lock.
 */
export async function assertActiveOwnedCompanyCapacity(
  tx: Prisma.TransactionClient,
  userId: string,
  resultingRole: string,
) {
  if (!isOwnerCompanyRole(resultingRole)) return 0;

  const count = await countActiveOwnedCompanies(tx, userId);
  if (count >= MAX_OWNED_COMPANIES_PER_USER) {
    throw new Error(OWNER_COMPANY_LIMIT_REACHED);
  }
  return count;
}
