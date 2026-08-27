import { describe, expect, it, vi } from "vitest";
import { CompanyDiscoveryService } from "@/backend/services/companies/company-discovery-service";
import {
  approvedCompanyFixture,
  publicJobCardFixture,
} from "../../../helpers/company-team-applications-fixture";

describe("Company detail integration projection", () => {
  it("derives size from active employees and keeps missing public fields explicit", async () => {
    const repository = {
      list: vi.fn(),
      findById: vi.fn().mockResolvedValue({
        ...approvedCompanyFixture,
        publicDescription: null,
        publicLocation: null,
        foundedYear: null,
        industry: null,
        activeEmployeeCount: 51,
      }),
    };
    const jobs = {
      searchScoped: vi.fn().mockResolvedValue({
        items: [publicJobCardFixture],
        total: 1,
        nextCursor: null,
        page: 1,
        totalPages: 1,
      }),
    };
    const opportunities = {
      listForCompany: vi.fn().mockResolvedValue([]),
    };

    const result = await new CompanyDiscoveryService(
      repository as never,
      jobs as never,
      opportunities as never,
    ).detail(approvedCompanyFixture.id, { kind: "visitor" });

    expect(result.sizeRange).toBe("51–200 employees");
    expect(result.description).toBe(
      "No public company description is available.",
    );
    expect(result.foundedYear).toBeNull();
    expect(result.industry).toBeNull();
    expect(result.location).toBeNull();
    expect(result.jobs).toHaveLength(1);
  });
});
