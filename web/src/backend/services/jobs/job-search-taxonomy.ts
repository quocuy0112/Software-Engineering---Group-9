import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { jobReviewSnapshotSchema } from "@/shared/contracts/recruiter-job-posting";
import type { JobSearchTaxonomy } from "@/shared/contracts/jobs/taxonomy";
import { recruiterIndustryTaxonomy } from "@/shared/contracts/jobs/industry-taxonomy";
import { defaultJobIndustryFiles } from "@/backend/repositories/jobs/job-industry-files";

export type { JobSearchTaxonomy } from "@/shared/contracts/jobs/taxonomy";

type TaxonomyRow = Readonly<{
  title: string;
  location: string;
  company: Readonly<{ industry: string | null }>;
  reviewAggregate: Readonly<{
    approvedVersion: Readonly<{ snapshot: unknown }> | null;
  }> | null;
}>;

type CandidateVisibleTaxonomyRow = TaxonomyRow &
  Readonly<{
    id: string;
  }>;

type MutableTitle = {
  name: string;
  categoryIds: Set<string>;
  count: number;
};

type MutableSubIndustry = {
  name: string;
  count: number;
  titles: Map<string, MutableTitle>;
};

type MutableIndustry = {
  code: string;
  name: string;
  count: number;
  subIndustries: Map<string, MutableSubIndustry>;
};

type TaxonomyEntry = Readonly<{
  industry: string;
  industryCode: string;
  subIndustry: string;
  title: string;
  categoryIds: readonly string[];
  location: Readonly<{ city: string; district: string | null }>;
}>;

const emptyTaxonomy: JobSearchTaxonomy = { industries: [], locations: [] };
const expectedIndustryCount = 29;

const taxonomyCatalogJobSchema = z.object({
  id: z.string().trim().min(1),
  industry: z.string().trim().min(1),
  industryCode: z.string().trim().min(1),
  categoryFamily: z.string().trim().min(1).optional(),
  subIndustry: z.string().trim().min(1),
  title: z.string().trim().min(1),
  categoryIds: z.array(z.string().trim().min(1)),
  status: z.string().trim().min(1),
  applyDeadline: z.string().datetime().nullable(),
  location: z.object({
    city: z.string().trim().min(1),
    district: z.string().trim().nullable(),
  }),
});

type TaxonomyCatalogJob = z.infer<typeof taxonomyCatalogJobSchema>;

function reportTaxonomyStage(stage: string, taxonomy: JobSearchTaxonomy) {
  if (process.env.NODE_ENV !== "development") return;
  const message = `[job-taxonomy] ${stage}: ${taxonomy.industries.length}/${expectedIndustryCount} industries`;
  if (taxonomy.industries.length === expectedIndustryCount)
    console.info(message);
  else console.warn(message);
}

/** Records that the server-rendered taxonomy crossed the RSC serialization boundary. */
export function reportJobSearchTaxonomySerialization(
  taxonomy: JobSearchTaxonomy,
) {
  reportTaxonomyStage("server-to-client serialization", taxonomy);
}

/**
 * Builds a compact, render-ready menu. It runs before render, never in
 * response to hover, so changing categories only switches precomputed panels.
 */
export function buildJobSearchTaxonomy(
  rows: readonly TaxonomyRow[],
): JobSearchTaxonomy {
  return buildTaxonomy(
    rows.map((row) => {
      const snapshot = jobReviewSnapshotSchema.safeParse(
        row.reviewAggregate?.approvedVersion?.snapshot,
      ).data;
      return {
        industry:
          snapshot?.industry || row.company.industry || "Other opportunities",
        industryCode:
          snapshot?.industryCode || snapshot?.categoryFamily || "r29",
        subIndustry: snapshot?.subIndustry || "Open roles",
        title: snapshot?.title || row.title,
        categoryIds: snapshot?.categoryIds ?? [],
        location: {
          city: snapshot?.location.city || row.location,
          district: snapshot?.location.district ?? null,
        },
      };
    }),
  );
}

/**
 * Uses the authoritative jobs catalog rather than candidate discovery's
 * transient database subset. Closed, filled, expired, draft, and rejected
 * records do not contribute to open-role counts.
 */
export function buildCatalogJobSearchTaxonomy(
  jobs: readonly TaxonomyCatalogJob[],
  now = new Date(),
): JobSearchTaxonomy {
  return buildTaxonomy(
    jobs
      .filter((job) => isCatalogJobOpen(job, now))
      .map((job) => ({
        industry: job.industry,
        industryCode: job.industryCode || job.categoryFamily || "r29",
        subIndustry: job.subIndustry,
        title: job.title,
        categoryIds: job.categoryIds,
        location: job.location,
      })),
  );
}

function isCatalogJobOpen(job: TaxonomyCatalogJob, now: Date) {
  if (!["open", "closing_soon", "active"].includes(job.status.toLowerCase())) {
    return false;
  }

  return !job.applyDeadline || new Date(job.applyDeadline) > now;
}

function nextCatalogTaxonomyRefreshAt(
  jobs: readonly TaxonomyCatalogJob[],
  now: Date,
) {
  let nextRefreshAt = Number.POSITIVE_INFINITY;

  for (const job of jobs) {
    if (
      !["open", "closing_soon", "active"].includes(job.status.toLowerCase())
    ) {
      continue;
    }
    if (!job.applyDeadline) continue;

    const deadline = new Date(job.applyDeadline).getTime();
    if (deadline > now.getTime() && deadline < nextRefreshAt) {
      nextRefreshAt = deadline;
    }
  }

  return nextRefreshAt;
}

function buildTaxonomy(entries: readonly TaxonomyEntry[]): JobSearchTaxonomy {
  const industries = new Map<string, MutableIndustry>();
  const locations = new Map<
    string,
    { label: string; value: string; count: number }
  >();
  const locationGroups = new Map<
    string,
    { city: string; count: number; districts: Map<string, number> }
  >();

  const addLocation = (label: string, value: string) => {
    const location = locations.get(value) ?? { label, value, count: 0 };
    locations.set(value, location);
    location.count += 1;
  };

  for (const entry of entries) {
    const industryCode =
      entry.industryCode === "other" ? "r29" : entry.industryCode;
    const industry = industries.get(industryCode) ?? {
      code: industryCode,
      name: entry.industry,
      count: 0,
      subIndustries: new Map(),
    };
    industries.set(industryCode, industry);
    industry.count += 1;

    const subIndustry = industry.subIndustries.get(entry.subIndustry) ?? {
      name: entry.subIndustry,
      count: 0,
      titles: new Map(),
    };
    industry.subIndustries.set(entry.subIndustry, subIndustry);
    subIndustry.count += 1;

    const title = subIndustry.titles.get(entry.title) ?? {
      name: entry.title,
      categoryIds: new Set(),
      count: 0,
    };
    subIndustry.titles.set(entry.title, title);
    title.count += 1;
    for (const categoryId of entry.categoryIds)
      title.categoryIds.add(categoryId);

    addLocation(entry.location.city, entry.location.city);
    const locationGroup = locationGroups.get(entry.location.city) ?? {
      city: entry.location.city,
      count: 0,
      districts: new Map(),
    };
    locationGroups.set(entry.location.city, locationGroup);
    locationGroup.count += 1;
    if (entry.location.district) {
      addLocation(
        `${entry.location.city} · ${entry.location.district}`,
        `${entry.location.district}, ${entry.location.city}`,
      );
      locationGroup.districts.set(
        entry.location.district,
        (locationGroup.districts.get(entry.location.district) ?? 0) + 1,
      );
    }
  }

  return {
    industries: [...industries.values()]
      .sort(
        (left, right) =>
          right.count - left.count || left.name.localeCompare(right.name),
      )
      .map((industry) => ({
        code: industry.code,
        name: industry.name,
        count: industry.count,
        subIndustries: [...industry.subIndustries.values()]
          .sort(
            (left, right) =>
              right.count - left.count || left.name.localeCompare(right.name),
          )
          .map((subIndustry) => ({
            name: subIndustry.name,
            count: subIndustry.count,
            titles: [...subIndustry.titles.values()]
              .sort(
                (left, right) =>
                  right.count - left.count ||
                  left.name.localeCompare(right.name),
              )
              .map((title) => ({
                name: title.name,
                categoryIds: [...title.categoryIds].sort(),
                count: title.count,
              })),
          })),
      })),
    locations: [...locations.values()].sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label),
    ),
    locationGroups: [...locationGroups.values()]
      .sort((left, right) => left.city.localeCompare(right.city))
      .map((locationGroup) => ({
        city: locationGroup.city,
        count: locationGroup.count,
        districts: [...locationGroup.districts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((left, right) => left.name.localeCompare(right.name)),
      })),
  };
}

/**
 * Reconcile observed counts/titles with the canonical recruiter taxonomy.
 * Search may still expose counts from the catalogue, but labels, ordering,
 * standard sub-industries, and predefined ids come from one shared source.
 * `r29` is the canonical code for Other. Legacy snapshots using `other` are
 * normalized before counts and sub-industries are reconciled.
 */
function applyCanonicalTaxonomy(
  computed: JobSearchTaxonomy,
): JobSearchTaxonomy {
  const dynamicByCode = new Map(
    computed.industries.map((industry) => [
      industry.code === "other" ? "r29" : industry.code,
      industry,
    ]),
  );

  return {
    ...computed,
    industries: recruiterIndustryTaxonomy.map((definition) => {
      const dynamic = dynamicByCode.get(definition.code);
      if (definition.subIndustries === null) {
        return {
          code: "r29",
          name: definition.label,
          count: dynamic?.count ?? 0,
          subIndustries: dynamic?.subIndustries ?? [],
        };
      }

      const dynamicBySubIndustry = new Map(
        dynamic?.subIndustries.map((subIndustry) => [
          subIndustry.name.trim().toLowerCase(),
          subIndustry,
        ]),
      );
      const canonicalNames = new Set(
        definition.subIndustries.map(([name]) => name.trim().toLowerCase()),
      );
      return {
        code: definition.code,
        name: definition.label,
        count: dynamic?.count ?? 0,
        subIndustries: [
          ...definition.subIndustries.map(([name, categoryId]) => {
            const observed = dynamicBySubIndustry.get(
              name.trim().toLowerCase(),
            );
            return {
              name,
              count: observed?.count ?? 0,
              titles:
                observed?.titles.map((title) => ({
                  ...title,
                  categoryIds: [categoryId],
                })) ?? [],
            };
          }),
          ...(dynamic?.subIndustries.filter(
            ({ name }) => !canonicalNames.has(name.trim().toLowerCase()),
          ) ?? []),
        ],
      };
    }),
  };
}

type CachedCatalogTaxonomy = Readonly<{
  taxonomy: JobSearchTaxonomy;
  refreshAt: number;
}>;

let catalogTaxonomyCache: CachedCatalogTaxonomy | null = null;
let catalogTaxonomyPromise: Promise<CachedCatalogTaxonomy> | null = null;
let candidateTaxonomyCache: CachedCatalogTaxonomy | null = null;
let candidateTaxonomyPromise: Promise<CachedCatalogTaxonomy> | null = null;

const candidateTaxonomyMaxAgeMs = 60_000;

function parseTaxonomyJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    // Accept the legacy terminal-comma fixture while it is repaired upstream.
    // Do not make arbitrary JSON recovery part of the catalog contract.
    const withoutTerminalComma = text.replace(/,\s*\](\s*)$/u, "]$1");
    if (withoutTerminalComma === text) throw error;
    if (process.env.NODE_ENV === "development") {
      console.warn("[job-taxonomy] catalog has a terminal trailing comma");
    }
    return JSON.parse(withoutTerminalComma) as unknown;
  }
}

async function readTaxonomyCatalog(): Promise<unknown> {
  const configuredPath = process.env.JOB_CATALOGUE_PATH?.trim();
  const path = configuredPath
    ? resolve(process.cwd(), configuredPath)
    : resolve(process.cwd(), "data", "jobs", "jobs.json");
  const useSplitFallback =
    !configuredPath ||
    path === resolve(process.cwd(), "data", "jobs", "jobs.json");
  try {
    return parseTaxonomyJson(await readFile(path, "utf8"));
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== "ENOENT" ||
      !useSplitFallback
    ) {
      throw error;
    }

    // jobs.json is the legacy monolith. Once it is removed, the generated
    // industry files are the complete catalogue and must all be present.
    const splitDocuments = await Promise.all(
      defaultJobIndustryFiles().map(async ({ filePath }) =>
        parseTaxonomyJson(await readFile(filePath, "utf8")),
      ),
    );
    return splitDocuments.flatMap((document) => {
      if (!Array.isArray(document)) throw new Error("JOB_CATALOGUE_MALFORMED");
      return document;
    });
  }
}

function locationFromDatabaseValue(location: string) {
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const city = parts.at(-1) || location;
  const district = parts.length > 1 ? parts.slice(0, -1).join(", ") : null;
  return { city, district };
}

function buildCandidateVisibleTaxonomy(
  catalog: readonly TaxonomyCatalogJob[],
  rows: readonly CandidateVisibleTaxonomyRow[],
): JobSearchTaxonomy {
  const catalogById = new Map(catalog.map((job) => [job.id, job]));
  const industryCodes = new Map(
    catalog.map((job) => [
      job.industry,
      job.industryCode || job.categoryFamily,
    ]),
  );

  return buildTaxonomy(
    rows.map((row) => {
      const catalogJob = catalogById.get(row.id);
      if (catalogJob) {
        return {
          industry: catalogJob.industry,
          industryCode:
            catalogJob.industryCode || catalogJob.categoryFamily || "other",
          subIndustry: catalogJob.subIndustry,
          title: catalogJob.title,
          categoryIds: catalogJob.categoryIds,
          location: catalogJob.location,
        };
      }

      const snapshot = jobReviewSnapshotSchema.safeParse(
        row.reviewAggregate?.approvedVersion?.snapshot,
      ).data;
      const industry =
        snapshot?.industry || row.company.industry || "Other opportunities";
      return {
        industry,
        industryCode:
          snapshot?.industryCode ||
          snapshot?.categoryFamily ||
          industryCodes.get(industry) ||
          "other",
        subIndustry: snapshot?.subIndustry || "Open roles",
        title: snapshot?.title || row.title,
        categoryIds: snapshot?.categoryIds ?? [],
        location: snapshot?.location || locationFromDatabaseValue(row.location),
      };
    }),
  );
}

async function readCandidateVisibleTaxonomyRows(
  now: Date,
): Promise<readonly CandidateVisibleTaxonomyRow[]> {
  const [{ prisma }, { candidateVisibleJobWhere }] = await Promise.all([
    import("@/backend/database/prisma"),
    import("@/backend/repositories/jobs/candidate-visible-job-policy"),
  ]);

  return prisma.jobPosting.findMany({
    where: candidateVisibleJobWhere(now),
    select: {
      id: true,
      title: true,
      location: true,
      company: { select: { industry: true } },
      reviewAggregate: {
        select: { approvedVersion: { select: { snapshot: true } } },
      },
    },
  });
}

/**
 * Uses the exact same public-visibility policy as JobDiscoveryService. This
 * keeps the header total and every category/location count in sync with the
 * jobs a candidate can actually discover.
 */
export async function listCandidateVisibleJobSearchTaxonomy(): Promise<JobSearchTaxonomy> {
  if (candidateTaxonomyCache && candidateTaxonomyCache.refreshAt > Date.now()) {
    return candidateTaxonomyCache.taxonomy;
  }

  const now = new Date();
  candidateTaxonomyPromise ??= Promise.all([
    readTaxonomyCatalog().then((catalog) =>
      z.array(taxonomyCatalogJobSchema).parse(catalog),
    ),
    readCandidateVisibleTaxonomyRows(now),
  ]).then(([catalog, rows]) => ({
    taxonomy: buildCandidateVisibleTaxonomy(catalog, rows),
    // A short cache avoids repeatedly parsing the complete catalog, while a
    // newly approved, expired, or seeded job is reflected promptly.
    refreshAt: now.getTime() + candidateTaxonomyMaxAgeMs,
  }));

  try {
    candidateTaxonomyCache = await candidateTaxonomyPromise;
    return candidateTaxonomyCache.taxonomy;
  } finally {
    candidateTaxonomyPromise = null;
  }
}

export async function listJobSearchTaxonomy(): Promise<JobSearchTaxonomy> {
  if (catalogTaxonomyCache && catalogTaxonomyCache.refreshAt > Date.now()) {
    return catalogTaxonomyCache.taxonomy;
  }

  catalogTaxonomyPromise ??= readTaxonomyCatalog().then((catalog) => {
    const jobs = z.array(taxonomyCatalogJobSchema).parse(catalog);
    const now = new Date();
    const computedTaxonomy = jobs.length
      ? buildCatalogJobSearchTaxonomy(jobs, now)
      : emptyTaxonomy;
    const taxonomy = applyCanonicalTaxonomy(computedTaxonomy);
    reportTaxonomyStage("catalog precompute", taxonomy);
    return {
      taxonomy,
      refreshAt: nextCatalogTaxonomyRefreshAt(jobs, now),
    };
  });
  try {
    catalogTaxonomyCache = await catalogTaxonomyPromise;
    return catalogTaxonomyCache.taxonomy;
  } finally {
    catalogTaxonomyPromise = null;
  }
}
