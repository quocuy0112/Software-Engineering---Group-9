import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyJobSearchService } from "@/backend/services/companies/company-job-search-service";
import {
  approvedCompanyFixture,
  publicJobCardFixture,
} from "../../../helpers/company-team-applications-fixture";

const { companyFindFirst, membershipCount } = vi.hoisted(() => ({
  companyFindFirst: vi.fn(),
  membershipCount: vi.fn(),
}));

vi.mock("@/backend/database/prisma", () => ({
  prisma: {
    company: { findFirst: companyFindFirst },
    companyMembership: { count: membershipCount },
  },
}));

describe("Company-scoped job search integration", () => {
  beforeEach(() => {
    companyFindFirst.mockReset();
    membershipCount.mockReset();
    companyFindFirst.mockResolvedValue(approvedCompanyFixture);
    membershipCount.mockResolvedValue(2);
  });

  it("normalizes filters and always passes the selected company scope to discovery", async () => {
    const discovery = {
      searchScoped: vi.fn().mockResolvedValue({
        items: [publicJobCardFixture],
        total: 1,
        nextCursor: null,
        page: 1,
        totalPages: 1,
      }),
    };
    const service = new CompanyJobSearchService(
      {} as never,
      discovery as never,
    );

    const result = await service.search(
      approvedCompanyFixture.id,
      {
        q: "  recruiter  ",
        location: " Ho Chi Minh City ",
        page: 1,
        limit: 50,
      },
      { kind: "visitor" },
    );

    expect(result.companyId).toBe(approvedCompanyFixture.id);
    expect(result.items).toEqual([publicJobCardFixture]);
    expect(discovery.searchScoped).toHaveBeenCalledWith(
      {
        q: "recruiter",
        location: "Ho Chi Minh City",
        searchBy: "BOTH",
        sort: "NEWEST",
        page: 1,
        limit: 50,
      },
      { kind: "visitor" },
      expect.any(Date),
      { companyId: approvedCompanyFixture.id },
    );
  });
});
