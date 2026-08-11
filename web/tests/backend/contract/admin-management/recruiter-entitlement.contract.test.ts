import { describe, expect, it } from "vitest";
import { recruiterEntitlementSchema } from "@/shared/contracts/admin/recruiter-entitlement";

describe("recruiter entitlement projection", () => {
  it("exposes exactly two non-privileged destinations", () => {
    const value = recruiterEntitlementSchema.parse({
      available: false,
      requiresSelection: false,
      selectedCompanyId: null,
      companies: [],
      destinations: [
        { label: "Candidate Dashboard", href: "/dashboard" },
        {
          label: "Employer Verification",
          href: "/dashboard/employer-verification",
        },
      ],
    });
    expect(value.destinations.map((item) => item.label)).toEqual([
      "Candidate Dashboard",
      "Employer Verification",
    ]);
  });
  it("rejects company-private fields", () => {
    expect(() =>
      recruiterEntitlementSchema.parse({
        available: true,
        requiresSelection: false,
        selectedCompanyId: "c1",
        companies: [
          {
            companyId: "c1",
            companyName: "Company",
            membershipId: "m1",
            membershipVersion: 1,
            role: "RECRUITER",
            candidateApplications: [],
          },
        ],
        destinations: [
          { label: "Candidate Dashboard", href: "/dashboard" },
          {
            label: "Employer Verification",
            href: "/dashboard/employer-verification",
          },
        ],
      }),
    ).toThrow();
  });
});
