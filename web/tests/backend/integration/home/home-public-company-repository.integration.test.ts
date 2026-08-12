import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/backend/database/prisma", () => ({
  prisma: { company: { findMany: mocks.findMany } },
}));

import { PrismaHomePublicCompanyRepository } from "@/backend/repositories/home/prisma-home-public-company-repository";

describe("Home public company repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("selects only active verified public fields and an authoritative job count", async () => {
    mocks.findMany.mockResolvedValue([
      {
        slug: "verified-company",
        displayName: "Verified Company",
        logoUrl: null,
        publicDescription: "Public summary",
        publicLocation: "Hà Nội",
        industry: "Technology",
        size: "51-200",
        _count: { jobPostings: 9 },
      },
    ]);
    const now = new Date("2026-08-12T00:00:00.000Z");
    const result = await new PrismaHomePublicCompanyRepository().list(now, 99);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        verificationState: "ACTIVE",
        verifiedAt: { not: null },
        verificationInactiveAt: null,
      },
      orderBy: [{ verifiedAt: "desc" }, { id: "asc" }],
      take: 6,
      select: expect.objectContaining({
        slug: true,
        displayName: true,
        logoUrl: true,
        publicDescription: true,
        publicLocation: true,
        industry: true,
        size: true,
        _count: {
          select: {
            jobPostings: {
              where: {
                status: "ACTIVE",
                approvedAt: { not: null },
                publishedAt: { not: null, lte: now },
                OR: [
                  { applicationDeadline: null },
                  { applicationDeadline: { gt: now } },
                ],
              },
            },
          },
        },
      }),
    });
    expect(result).toEqual([
      {
        slug: "verified-company",
        displayName: "Verified Company",
        logoUrl: null,
        publicDescription: "Public summary",
        publicLocation: "Hà Nội",
        industry: "Technology",
        size: "51-200",
        openPositionCount: 9,
      },
    ]);
    expect(JSON.stringify(mocks.findMany.mock.calls[0][0])).not.toMatch(
      /tax|membership|private|address|culture|badge/iu,
    );
  });
});
