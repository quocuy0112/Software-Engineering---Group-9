import { describe, expect, it } from "vitest";
import { privilegedCommandSchema } from "@/shared/contracts/admin/commands";
import {
  companyMembershipSchema,
  companyReferenceSchema,
} from "@/shared/contracts/admin/resources";
import { adminContractPaths } from "@/shared/contracts/admin/generated";

describe("company-scoped membership contract", () => {
  it("keeps companies and memberships distinct and company-scoped", () => {
    expect(
      companyReferenceSchema.parse({
        id: "company-1",
        legalName: "One",
        verificationState: "ACTIVE",
      }),
    ).toEqual({
      id: "company-1",
      legalName: "One",
      verificationState: "ACTIVE",
    });
    expect(
      companyMembershipSchema.parse({
        id: "membership-1",
        company: {
          id: "company-1",
          legalName: "One",
          verificationState: "ACTIVE",
        },
        accountId: "account-1",
        role: "RECRUITER",
        state: "ACTIVE",
        priorApprovedRole: "RECRUITER",
        version: 2,
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-10T00:00:00.000Z",
      }).company.id,
    ).toBe("company-1");
  });

  it("requires confirmation, category, and a 10–500 character rationale", () => {
    const valid = {
      idempotencyKey: "10000000-0000-4000-8000-000000000001",
      expectedVersion: 1,
      confirmation: true,
      reasonCategory: "ACCESS_CLEANUP",
      explanation: "Access is no longer required.",
    };
    expect(privilegedCommandSchema.parse(valid)).toMatchObject(valid);
    expect(
      privilegedCommandSchema.safeParse({ ...valid, explanation: "short" })
        .success,
    ).toBe(false);
    expect(
      privilegedCommandSchema.safeParse({ ...valid, confirmation: false })
        .success,
    ).toBe(false);
  });

  it("publishes only explicit read and lifecycle paths", () => {
    expect(adminContractPaths).toEqual(
      expect.arrayContaining([
        "/api/admin/companies",
        "/api/admin/company-memberships",
        "/api/admin/company-memberships/{membershipId}",
        "/api/admin/company-memberships/{membershipId}/{action}",
      ]),
    );
  });
});
