import "server-only";

import { configuredJsonJobCatalogueRepository } from "@/backend/repositories/jobs/job-catalogue-repository-factory";
import { prisma } from "@/backend/database/prisma";
import {
  companyCatalogSchema,
  jobCatalogSchema,
  type JobCatalogItem,
} from "@/shared/contracts/jobs/catalog";
import { jobReviewSnapshotSchema } from "@/shared/contracts/recruiter-job-posting";

const jobsRepository = configuredJsonJobCatalogueRepository("jobs.json");
const companiesRepository =
  configuredJsonJobCatalogueRepository("companies.json");

function nowIso(now: Date) {
  return now.toISOString();
}

/**
 * Resolve the legacy JSON company id used by the catalogue. Review snapshots
 * deliberately store the verified PostgreSQL company id, while the split JSON
 * catalogue can still contain a tax-code based legacy id.
 */
async function catalogueCompanyId(
  snapshot: Pick<JobCatalogItem, "companyId">,
  existing: JobCatalogItem | undefined,
) {
  if (existing?.companyId) return existing.companyId;

  const company = await prisma.company.findUnique({
    where: { id: snapshot.companyId },
    select: { normalizedTaxIdentifier: true },
  });
  if (company?.normalizedTaxIdentifier) {
    const rawCompanies = await companiesRepository.read();
    const match = rawCompanies.find((value) => {
      const parsed = companyCatalogSchema.safeParse(value);
      return (
        parsed.success &&
        parsed.data.taxCode === company.normalizedTaxIdentifier
      );
    });
    if (match) {
      const parsed = companyCatalogSchema.parse(match);
      return parsed.id;
    }
  }

  // A database-backed company normally has a legacy catalogue row. Keeping
  // the authoritative id as a fallback avoids dropping an approved posting
  // if a deployment has not migrated that company into companies.json yet.
  return snapshot.companyId;
}

export async function publishApprovedJobToCatalogue(input: {
  snapshot: unknown;
  now: Date;
  status?: "active" | "closed";
}) {
  const snapshot = jobReviewSnapshotSchema.parse(input.snapshot);
  const rawJobs = await jobsRepository.readIndustryPartition(
    snapshot.industryCode,
  );
  const existingRaw = rawJobs.find(
    (value) =>
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as { id?: unknown }).id === snapshot.id,
  );
  const existing = existingRaw ? jobCatalogSchema.safeParse(existingRaw) : null;
  const existingJob = existing?.success ? existing.data : undefined;
  const companyId = await catalogueCompanyId(snapshot, existingJob);
  const timestamp = nowIso(input.now);
  const approved = jobCatalogSchema.parse({
    ...snapshot,
    companyId,
    status: input.status ?? "active",
    approvalComment: null,
    isVerified: existingJob?.isVerified ?? false,
    postedAt: existingJob?.postedAt ?? timestamp,
    updatedAt: timestamp,
    stats: existingJob?.stats ?? { viewCount: 0, applicantCount: 0 },
  });

  await jobsRepository.mutateIndustryPartition(
    approved.industryCode,
    (values) => {
      const next = values.filter(
        (value) =>
          !(
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            (value as { id?: unknown }).id === approved.id
          ),
      );
      return [...next, approved];
    },
  );
  return approved;
}
