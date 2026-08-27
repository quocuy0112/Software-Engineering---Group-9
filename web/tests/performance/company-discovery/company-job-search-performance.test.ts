import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyJobSearchService } from "@/backend/services/companies/company-job-search-service";
import {
  approvedCompanyFixture,
  publicJobCardFixture,
} from "../../helpers/company-team-applications-fixture";

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

describe("Company job search performance", () => {
  beforeEach(() => {
    companyFindFirst.mockResolvedValue(approvedCompanyFixture);
    membershipCount.mockResolvedValue(2);
  });

  it("keeps representative scoped searches below the two-second P95 target", async () => {
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
    const durations: number[] = [];

    for (let index = 0; index < 20; index += 1) {
      const started = performance.now();
      await service.search(
        approvedCompanyFixture.id,
        { q: "recruiter", location: "ho chi minh", page: 1, limit: 50 },
        { kind: "visitor" },
      );
      durations.push(performance.now() - started);
    }

    durations.sort((left, right) => left - right);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1] ?? Infinity;
    expect(p95).toBeLessThan(2_000);
  });
});
