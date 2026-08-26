import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/backend/generated/prisma/client";
import {
  assertActiveOwnedCompanyCapacity,
  countActiveOwnedCompanies,
} from "@/backend/company-members/company-ownership-limit";
import {
  MAX_OWNED_COMPANIES_PER_USER,
  OWNER_COMPANY_LIMIT_REACHED,
} from "@/shared/contracts/company-ownership";

function transactionWithOwnerCount(ownerCount: number) {
  return {
    companyMembership: {
      count: vi.fn().mockResolvedValue(ownerCount),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("company ownership limit", () => {
  it("counts only active owner memberships", async () => {
    const transaction = transactionWithOwnerCount(2);

    await expect(
      countActiveOwnedCompanies(transaction, "user-1"),
    ).resolves.toBe(2);
    expect(transaction.companyMembership.count).toHaveBeenCalledWith({
      where: { userId: "user-1", role: "OWNER", status: "ACTIVE" },
    });
  });

  it("does not consume ownership capacity for invited member roles", async () => {
    const transaction = transactionWithOwnerCount(MAX_OWNED_COMPANIES_PER_USER);

    await expect(
      assertActiveOwnedCompanyCapacity(transaction, "user-1", "RECRUITER"),
    ).resolves.toBe(0);
    await expect(
      assertActiveOwnedCompanyCapacity(transaction, "user-1", "HR_MANAGER"),
    ).resolves.toBe(0);
    expect(transaction.companyMembership.count).not.toHaveBeenCalled();
  });

  it("rejects a new owner when the three-company limit is reached", async () => {
    const transaction = transactionWithOwnerCount(MAX_OWNED_COMPANIES_PER_USER);

    await expect(
      assertActiveOwnedCompanyCapacity(transaction, "user-1", "OWNER"),
    ).rejects.toThrow(OWNER_COMPANY_LIMIT_REACHED);
  });
});
