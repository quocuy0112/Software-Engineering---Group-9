import { describe, expect, it, vi } from "vitest";
import {
  createPendingJobTaxonomyProposal,
  normalizeTaxonomyName,
  resolveJobTaxonomy,
  resolveApprovedJobTaxonomy,
} from "@/backend/services/jobs/job-taxonomy-service";

function delegate(overrides: Record<string, unknown> = {}) {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("shared job taxonomy service", () => {
  it("normalizes accents, punctuation, and whitespace for duplicate detection", () => {
    expect(normalizeTaxonomyName("  Café / Product   Design  ")).toBe(
      "cafe product design",
    );
    expect(normalizeTaxonomyName("Cafe Product Design")).toBe(
      "cafe product design",
    );
  });

  it("creates a proposal for a custom sub-industry instead of promoting it immediately", async () => {
    const industry = delegate({
      findFirst: vi.fn().mockResolvedValue({
        id: "r03",
        code: "r03",
        name: "Information Technology (IT)",
      }),
    });
    const subIndustry = delegate();
    const proposal = delegate({
      create: vi.fn().mockResolvedValue({ id: "proposal-1" }),
    });
    const db = {
      jobIndustry: industry,
      jobSubIndustry: subIndustry,
      jobTaxonomyProposal: proposal,
    } as never;

    const result = await createPendingJobTaxonomyProposal({
      db,
      reviewVersionId: "review-1",
      companyId: "company-1",
      requestedByUserId: "user-1",
      industryCode: "r03",
      industryName: "Information Technology (IT)",
      subIndustryName: "  Aerospace Operations ",
      description: "A specialist team",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(result).toEqual({ id: "proposal-1" });
    expect(proposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          industryId: "r03",
          proposedName: "Aerospace Operations",
          normalizedName: "aerospace operations",
          status: "PENDING_APPROVAL",
        }),
      }),
    );
  });

  it("creates a deterministic shared sub-industry when the administrator approves the proposal", async () => {
    const industry = delegate({
      findFirst: vi.fn().mockResolvedValue({
        id: "r03",
        code: "r03",
        name: "Information Technology (IT)",
      }),
    });
    const subIndustry = delegate({
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({
        id: "r03-aerospace-operations-hash",
        code: "r03-aerospace-operations-hash",
        name: "Aerospace Operations",
      }),
    });
    const proposal = delegate({
      findUnique: vi.fn().mockResolvedValue({
        id: "proposal-1",
        status: "PENDING_APPROVAL",
        proposedName: "Aerospace Operations",
        normalizedName: "aerospace operations",
        resolvedSubIndustryId: null,
      }),
      update: vi.fn().mockResolvedValue({ id: "proposal-1" }),
    });
    const db = {
      jobIndustry: industry,
      jobSubIndustry: subIndustry,
      jobTaxonomyProposal: proposal,
    } as never;

    const result = await resolveApprovedJobTaxonomy({
      db,
      reviewVersionId: "review-1",
      industryCode: "r03",
      industryName: "Information Technology (IT)",
      subIndustryName: "Aerospace Operations",
      adminUserId: "admin-1",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      industryId: "r03",
      subIndustryId: "r03-aerospace-operations-hash",
      subIndustryCode: "r03-aerospace-operations-hash",
      categoryIds: ["r03-aerospace-operations-hash"],
    });
    expect(subIndustry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          industryId_normalizedName: {
            industryId: "r03",
            normalizedName: "aerospace operations",
          },
        },
      }),
    );
    expect(proposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
          resolvedSubIndustryId: "r03-aerospace-operations-hash",
        }),
      }),
    );
  });

  it("maps a duplicate pending proposal to a shared row promoted by an earlier approval", async () => {
    const industry = delegate({
      findFirst: vi.fn().mockResolvedValue({
        id: "r03",
        code: "r03",
        name: "Information Technology (IT)",
      }),
    });
    const subIndustry = delegate({
      findFirst: vi.fn().mockResolvedValue({
        id: "r03-aerospace-operations-hash",
        code: "r03-aerospace-operations-hash",
        name: "Aerospace Operations",
        status: "ACTIVE",
      }),
    });
    const proposal = delegate({
      findUnique: vi.fn().mockResolvedValue({
        id: "proposal-2",
        status: "PENDING_APPROVAL",
        proposedName: "Aerospace Operations",
        normalizedName: "aerospace operations",
        resolvedSubIndustryId: null,
      }),
    });
    const db = {
      jobIndustry: industry,
      jobSubIndustry: subIndustry,
      jobTaxonomyProposal: proposal,
    } as never;

    const result = await resolveApprovedJobTaxonomy({
      db,
      reviewVersionId: "review-2",
      industryCode: "r03",
      industryName: "Information Technology (IT)",
      subIndustryName: "Aerospace Operations",
      adminUserId: "admin-2",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      subIndustryId: "r03-aerospace-operations-hash",
      subIndustryCode: "r03-aerospace-operations-hash",
    });
    expect(subIndustry.upsert).not.toHaveBeenCalled();
    expect(proposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proposal-2" },
        data: expect.objectContaining({
          status: "MAPPED",
          resolvedSubIndustryId: "r03-aerospace-operations-hash",
        }),
      }),
    );
  });

  it("does not reactivate a sub-industry that an administrator deactivated", async () => {
    const industry = delegate({
      findFirst: vi.fn().mockResolvedValue({
        id: "r03",
        code: "r03",
        name: "Information Technology (IT)",
      }),
    });
    const subIndustry = delegate({
      findFirst: vi.fn().mockResolvedValue({
        id: "r03-aerospace-operations-hash",
        code: "r03-aerospace-operations-hash",
        name: "Aerospace Operations",
        status: "INACTIVE",
      }),
    });
    const proposal = delegate({
      findUnique: vi.fn().mockResolvedValue({
        id: "proposal-3",
        status: "PENDING_APPROVAL",
        proposedName: "Aerospace Operations",
        normalizedName: "aerospace operations",
        resolvedSubIndustryId: null,
      }),
      update: vi.fn().mockResolvedValue({ id: "proposal-3" }),
    });
    const db = {
      jobIndustry: industry,
      jobSubIndustry: subIndustry,
      jobTaxonomyProposal: proposal,
    } as never;

    const result = await resolveApprovedJobTaxonomy({
      db,
      reviewVersionId: "review-3",
      industryCode: "r03",
      industryName: "Information Technology (IT)",
      subIndustryName: "Aerospace Operations",
      adminUserId: "admin-3",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      subIndustryId: "r03-aerospace-operations-hash",
      subIndustryCode: "r03-aerospace-operations-hash",
    });
    expect(subIndustry.update).not.toHaveBeenCalled();
    expect(proposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "MAPPED",
          resolvedSubIndustryId: "r03-aerospace-operations-hash",
        }),
      }),
    );
  });

  it("does not map a new approved job to a removed sub-industry", async () => {
    const industry = delegate({
      findFirst: vi.fn().mockResolvedValue({
        id: "r03",
        code: "r03",
        name: "Information Technology (IT)",
      }),
    });
    const subIndustry = delegate({
      findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: "r03-legacy-role",
        code: "r03-legacy-role",
        name: "Legacy Role",
        status: "REMOVED",
      }),
    });
    const proposal = delegate({
      findUnique: vi.fn().mockResolvedValue({
        id: "proposal-removed",
        status: "PENDING_APPROVAL",
        proposedName: "Legacy Role",
        normalizedName: "legacy role",
        resolvedSubIndustryId: null,
      }),
      update: vi.fn().mockResolvedValue({ id: "proposal-removed" }),
    });
    const db = {
      jobIndustry: industry,
      jobSubIndustry: subIndustry,
      jobTaxonomyProposal: proposal,
    } as never;

    const result = await resolveApprovedJobTaxonomy({
      db,
      reviewVersionId: "review-removed",
      industryCode: "r03",
      industryName: "Information Technology (IT)",
      subIndustryName: "Legacy Role",
      adminUserId: "admin-removed",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      industryId: "r03",
      subIndustryId: null,
      subIndustryCode: null,
      categoryIds: [],
    });
    expect(subIndustry.upsert).not.toHaveBeenCalled();
    expect(proposal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proposal-removed" },
        data: expect.objectContaining({
          status: "REJECTED",
          reviewReason: expect.stringContaining("removed"),
        }),
      }),
    );
  });

  it("resolves the legacy Other code to the global r29 industry", async () => {
    const industry = delegate({
      findFirst: vi.fn().mockResolvedValue({
        id: "r29",
        code: "r29",
        name: "Other",
      }),
    });
    const subIndustry = delegate();
    const db = {
      jobIndustry: industry,
      jobSubIndustry: subIndustry,
    } as never;

    const result = await resolveJobTaxonomy(db, {
      industryCode: "other",
      industryName: "Other",
      subIndustryName: "Aerospace Operations",
    });

    expect(result).toMatchObject({
      industryId: "r29",
      industryCode: "r29",
      industryName: "Other",
    });
    expect(industry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ id: "r29" }, { code: "r29" }],
        }),
      }),
    );
  });
});
