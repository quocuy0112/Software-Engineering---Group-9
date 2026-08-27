import { describe, expect, it } from "vitest";
import { companyDetailSchema } from "@/shared/contracts/company";
import {
  approvedCompanyFixture,
  publicJobCardFixture,
  teamRoleFixtures,
} from "../../helpers/company-team-applications-fixture";

describe("Company detail contract", () => {
  it("accepts public metadata, team entry points, and ordinary jobs", () => {
    const detail = companyDetailSchema.parse({
      companyId: approvedCompanyFixture.id,
      slug: approvedCompanyFixture.slug,
      name: approvedCompanyFixture.displayName,
      logoUrl: null,
      description: approvedCompanyFixture.publicDescription,
      foundedYear: approvedCompanyFixture.foundedYear,
      sizeRange: "1–10 employees",
      industry: approvedCompanyFixture.industry,
      location: approvedCompanyFixture.publicLocation,
      activeEmployeeCount: 2,
      teamRoles: teamRoleFixtures,
      jobs: [publicJobCardFixture],
      jobTotal: 1,
      jobPage: 1,
      jobTotalPages: 1,
    });
    expect(detail.teamRoles).toEqual(teamRoleFixtures);
    expect(detail.jobs[0]?.id).toBe(publicJobCardFixture.id);
    expect(detail.jobTotalPages).toBe(1);
  });
});
