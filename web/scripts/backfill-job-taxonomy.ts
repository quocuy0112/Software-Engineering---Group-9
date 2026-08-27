import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url), quiet: true });

import type { JobIndustryCode } from "../src/backend/repositories/jobs/job-industry-files";
import type { JobCatalogItem } from "../src/shared/contracts/jobs/catalog";

const apply = process.argv.includes("--apply");
const legacyStatusMap: Record<string, JobCatalogItem["status"]> = {
  open: "active",
  closing_soon: "active",
  filled: "closed",
  expired: "closed",
};
type RawCatalogueJob = Omit<JobCatalogItem, "status"> & { status: string };

async function main() {
  const { prisma } = await import("../src/backend/database/prisma");
  const { configuredJsonJobCatalogueRepository } =
    await import("../src/backend/repositories/jobs/job-catalogue-repository-factory");
  const { catalogueIndustryCode } =
    await import("../src/backend/repositories/jobs/job-industry-files");
  const { jobCatalogSchema } =
    await import("../src/shared/contracts/jobs/catalog");
  const { jobReviewSnapshotSchema } =
    await import("../src/shared/contracts/recruiter-job-posting");
  const { normalizeTaxonomyName } =
    await import("../src/backend/services/jobs/job-taxonomy-service");
  const validateCatalogueJob = (job: RawCatalogueJob) =>
    jobCatalogSchema.parse({
      ...job,
      status: legacyStatusMap[job.status] ?? job.status,
    });

  const [industries, subIndustries, jobs, catalogue] = await Promise.all([
    prisma.jobIndustry.findMany({
      select: { id: true, code: true },
    }),
    prisma.jobSubIndustry.findMany({
      select: { id: true, code: true, industryId: true, name: true },
    }),
    prisma.jobPosting.findMany({
      select: {
        id: true,
        industryId: true,
        subIndustryId: true,
        industryCode: true,
        subIndustryCode: true,
        reviewAggregate: {
          select: { approvedVersion: { select: { snapshot: true } } },
        },
      },
    }),
    configuredJsonJobCatalogueRepository<RawCatalogueJob>("jobs.json").read(),
  ]);

  const industryByCode = new Map(
    industries.flatMap((industry) => [
      [industry.id, industry],
      [industry.code, industry],
    ]),
  );
  const subIndustryByKey = new Map(
    subIndustries.map((subIndustry) => [
      `${subIndustry.industryId}:${normalizeTaxonomyName(subIndustry.name)}`,
      subIndustry,
    ]),
  );
  const subIndustryByCode = new Map(
    subIndustries.flatMap((subIndustry) => [
      [subIndustry.id, subIndustry],
      [subIndustry.code, subIndustry],
    ]),
  );
  const catalogueById = new Map(catalogue.map((job) => [job.id, job]));

  const resolve = (input: {
    industryCode?: string | null;
    industryId?: string | null;
    subIndustry?: string | null;
    subIndustryCode?: string | null;
    subIndustryId?: string | null;
  }) => {
    const industry =
      industryByCode.get(input.industryId ?? "") ??
      industryByCode.get(input.industryCode ?? "");
    if (!industry) return null;
    const direct =
      subIndustryByCode.get(input.subIndustryId ?? "") ??
      subIndustryByCode.get(input.subIndustryCode ?? "");
    const subIndustry =
      direct?.industryId === industry.id
        ? direct
        : subIndustryByKey.get(
            `${industry.id}:${normalizeTaxonomyName(input.subIndustry ?? "")}`,
          );
    return { industry, subIndustry: subIndustry ?? null };
  };

  let databaseUnresolved = 0;
  const databaseChanges = jobs.flatMap((job) => {
    const snapshot = job.reviewAggregate?.approvedVersion?.snapshot;
    const parsed = jobReviewSnapshotSchema.safeParse(snapshot);
    // Older development imports stored the taxonomy only in the JSON
    // catalogue. Prefer PostgreSQL/review data, but use the matching
    // catalogue row as a bounded migration fallback for those legacy rows.
    const catalogueJob = catalogueById.get(job.id);
    const resolved = resolve({
      industryCode:
        job.industryCode ??
        (parsed.success ? parsed.data.industryCode : null) ??
        catalogueJob?.industryCode ??
        catalogueJob?.categoryFamily ??
        null,
      industryId:
        job.industryId ??
        (parsed.success ? parsed.data.industryId : null) ??
        catalogueJob?.industryId ??
        null,
      subIndustry:
        (parsed.success ? parsed.data.subIndustry : null) ??
        catalogueJob?.subIndustry ??
        null,
      subIndustryCode:
        job.subIndustryCode ??
        (parsed.success ? parsed.data.subIndustryCode : null) ??
        catalogueJob?.subIndustryCode ??
        catalogueJob?.categoryIds[0] ??
        null,
      subIndustryId:
        job.subIndustryId ??
        (parsed.success ? parsed.data.subIndustryId : null) ??
        catalogueJob?.subIndustryId ??
        catalogueJob?.subIndustryCode ??
        catalogueJob?.categoryIds[0] ??
        null,
    });
    if (!resolved) {
      databaseUnresolved += 1;
      return [];
    }
    const change = {
      id: job.id,
      industryId: resolved.industry.id,
      subIndustryId: resolved.subIndustry?.id ?? null,
      industryCode: resolved.industry.code,
      subIndustryCode: resolved.subIndustry?.code ?? null,
    };
    if (
      job.industryId !== change.industryId ||
      job.subIndustryId !== change.subIndustryId ||
      job.industryCode !== change.industryCode ||
      job.subIndustryCode !== change.subIndustryCode
    ) {
      return [change];
    }
    return [];
  });

  const catalogueChanges = catalogue.flatMap((job) => {
    validateCatalogueJob(job);
    const resolved = resolve(job);
    if (!resolved) return [];
    const next: RawCatalogueJob = {
      ...job,
      industryId: resolved.industry.id,
      industryCode: resolved.industry.code,
      subIndustryId: resolved.subIndustry?.id ?? null,
      subIndustryCode: resolved.subIndustry?.code ?? null,
      categoryIds: resolved.subIndustry
        ? [resolved.subIndustry.code]
        : job.categoryIds,
    };
    if (
      job.industryId === next.industryId &&
      job.subIndustryId === next.subIndustryId &&
      job.subIndustryCode === next.subIndustryCode &&
      job.industryCode === next.industryCode &&
      job.categoryIds.join("\u0000") === next.categoryIds.join("\u0000")
    )
      return [];
    return [{ before: job, after: next }];
  });

  if (apply) {
    const repository =
      configuredJsonJobCatalogueRepository<RawCatalogueJob>("jobs.json");
    const codes = [
      ...new Set(
        catalogueChanges
          .map(({ before }) => catalogueIndustryCode(before.industryCode))
          .filter((code): code is JobIndustryCode => Boolean(code)),
      ),
    ];
    if (codes.length) {
      await repository.mutateIndustryPartitions(codes, (partitions) => {
        for (const [code, values] of partitions) {
          const changes = new Map(
            catalogueChanges
              .filter(
                ({ before }) =>
                  catalogueIndustryCode(before.industryCode) === code,
              )
              .map(({ before, after }) => [before.id, after]),
          );
          partitions.set(
            code,
            values.map((value) => changes.get(value.id) ?? value),
          );
        }
      });
    }
    for (const change of databaseChanges) {
      await prisma.jobPosting.update({
        where: { id: change.id },
        data: change,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        databaseRows: jobs.length,
        databaseChanges: databaseChanges.length,
        databaseUnresolved,
        catalogueRows: catalogue.length,
        catalogueChanges: catalogueChanges.length,
        activeTaxonomyIndustries: industries.length,
        activeTaxonomySubIndustries: subIndustries.length,
      },
      null,
      2,
    ),
  );
}

void main();
