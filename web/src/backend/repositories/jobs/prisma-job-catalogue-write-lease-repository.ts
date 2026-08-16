import "server-only";
import { prisma } from "@/backend/database/prisma";
import type {
  JobCatalogueLeaseClaim,
  JobCatalogueLeaseCoordinator,
} from "./json-job-catalogue-repository";

type LeaseDatabase = Pick<
  typeof prisma,
  "jobCatalogueWriteLease" | "$transaction"
>;

export class PrismaJobCatalogueWriteLeaseRepository implements JobCatalogueLeaseCoordinator {
  constructor(private readonly db: LeaseDatabase = prisma) {}

  async claim(
    input: Omit<JobCatalogueLeaseClaim, "version">,
  ): Promise<JobCatalogueLeaseClaim> {
    return this.db.$transaction(async (transaction) => {
      const existing = await transaction.jobCatalogueWriteLease.findUnique({
        where: { catalogueKey: input.catalogueKey },
      });
      if (!existing) {
        return transaction.jobCatalogueWriteLease.create({ data: input });
      }
      if (existing.leaseExpiresAt > new Date())
        throw new Error("JOB_CATALOGUE_LEASE_BUSY");
      const result = await transaction.jobCatalogueWriteLease.updateMany({
        where: {
          catalogueKey: input.catalogueKey,
          version: existing.version,
          leaseExpiresAt: existing.leaseExpiresAt,
        },
        data: { ...input, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new Error("JOB_CATALOGUE_LEASE_BUSY");
      const claimed = await transaction.jobCatalogueWriteLease.findUnique({
        where: { catalogueKey: input.catalogueKey },
      });
      if (!claimed) throw new Error("JOB_CATALOGUE_LEASE_LOST");
      return claimed;
    });
  }

  async renew(claim: JobCatalogueLeaseClaim, leaseExpiresAt: Date) {
    const result = await this.db.jobCatalogueWriteLease.updateMany({
      where: {
        catalogueKey: claim.catalogueKey,
        ownerTokenHash: claim.ownerTokenHash,
        expectedCatalogueSha256: claim.expectedCatalogueSha256,
        version: claim.version,
        leaseExpiresAt: { gt: new Date() },
      },
      data: { leaseExpiresAt },
    });
    if (result.count !== 1) throw new Error("JOB_CATALOGUE_LEASE_LOST");
    return { ...claim, leaseExpiresAt };
  }

  async assertOwned(
    claim: JobCatalogueLeaseClaim,
    expectedCatalogueSha256: string,
  ) {
    const owned = await this.db.jobCatalogueWriteLease.findFirst({
      where: {
        catalogueKey: claim.catalogueKey,
        ownerTokenHash: claim.ownerTokenHash,
        expectedCatalogueSha256,
        version: claim.version,
        leaseExpiresAt: { gt: new Date() },
      },
      select: { catalogueKey: true },
    });
    if (!owned) throw new Error("JOB_CATALOGUE_LEASE_LOST");
  }

  async release(claim: JobCatalogueLeaseClaim) {
    await this.db.jobCatalogueWriteLease.updateMany({
      where: {
        catalogueKey: claim.catalogueKey,
        ownerTokenHash: claim.ownerTokenHash,
        version: claim.version,
      },
      data: { leaseExpiresAt: new Date() },
    });
  }
}
