import { describe, expect, it } from "vitest";
import { publicCompanyWhere } from "@/backend/repositories/companies/prisma-company-discovery-repository";
import { companyCardSchema } from "@/shared/contracts/company";

describe("public Company privacy boundary", () => {
  it("requires every public company projection to be approved, active, and moderated", () => {
    expect(publicCompanyWhere).toEqual({
      verifiedAt: { not: null },
      verificationState: "ACTIVE",
      verificationInactiveAt: null,
      moderationState: "ACTIVE",
    });
  });

  it("rejects private administration fields from a public company card", () => {
    expect(
      companyCardSchema.safeParse({
        companyId: "company-1",
        slug: "northstar-labs",
        name: "Northstar Labs",
        logoUrl: null,
        description: "Public profile",
        ownerUserId: "owner-1",
        taxCode: "private",
      }).success,
    ).toBe(false);
  });
});
