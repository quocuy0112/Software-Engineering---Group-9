import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/backend/database/prisma";
import type { Prisma } from "@/backend/generated/prisma/client";
import {
  recruiterIndustryTaxonomy,
  slugifyRecruiterSubIndustry,
} from "@/shared/contracts/jobs/industry-taxonomy";
import {
  recruiterJobTaxonomySchema,
  type RecruiterJobTaxonomy,
} from "@/shared/contracts/jobs/job-taxonomy";

type TaxonomyDb = typeof prisma | Prisma.TransactionClient;

type Delegate = {
  findMany(args?: unknown): Promise<unknown>;
  findFirst(args?: unknown): Promise<unknown>;
  findUnique(args?: unknown): Promise<unknown>;
  create(args?: unknown): Promise<unknown>;
  upsert(args?: unknown): Promise<unknown>;
  update(args?: unknown): Promise<unknown>;
};

function delegate(db: TaxonomyDb, name: string): Delegate | null {
  const value = (db as unknown as Record<string, unknown>)[name];
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<Delegate>;
  return typeof candidate.findMany === "function" &&
    typeof candidate.findFirst === "function" &&
    typeof candidate.findUnique === "function" &&
    typeof candidate.create === "function" &&
    typeof candidate.upsert === "function" &&
    typeof candidate.update === "function"
    ? (candidate as Delegate)
    : null;
}

const dbSubIndustrySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  status: z.string(),
});

const dbIndustrySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  status: z.string(),
  version: z.number().int().nonnegative(),
  subIndustries: z.array(dbSubIndustrySchema),
});

const dbProposalSchema = z.object({
  id: z.string(),
  status: z.string(),
  proposedName: z.string(),
  normalizedName: z.string(),
  resolvedSubIndustryId: z.string().nullable(),
});

export function normalizeTaxonomyName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[\u0111\u0110]/gu, "d")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function staticTaxonomy(): RecruiterJobTaxonomy {
  return recruiterJobTaxonomySchema.parse({
    version: "static-v1",
    industries: recruiterIndustryTaxonomy.map((industry) => ({
      code: industry.code,
      label: industry.label,
      subIndustries: (industry.subIndustries ?? []).map(([label, code]) => ({
        code,
        label,
      })),
    })),
  });
}

let taxonomyCache: { value: RecruiterJobTaxonomy; expiresAt: number } | null =
  null;
let taxonomyPromise: Promise<RecruiterJobTaxonomy> | null = null;

export function invalidateJobTaxonomyCache() {
  taxonomyCache = null;
  taxonomyPromise = null;
}

async function readDatabaseTaxonomy(): Promise<RecruiterJobTaxonomy | null> {
  const industries = delegate(prisma, "jobIndustry");
  if (!industries) return null;
  const raw = await industries.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    include: {
      subIndustries: {
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      },
    },
  });
  const parsed = z.array(dbIndustrySchema).safeParse(raw);
  if (!parsed.success || !parsed.data.length) return null;
  return recruiterJobTaxonomySchema.parse({
    version: `db-v${Math.max(...parsed.data.map((industry) => industry.version))}`,
    industries: parsed.data.map((industry) => ({
      code: industry.code,
      label: industry.name,
      subIndustries: industry.subIndustries
        .filter((subIndustry) => subIndustry.status === "ACTIVE")
        .map((subIndustry) => ({
          code: subIndustry.code,
          label: subIndustry.name,
        })),
    })),
  });
}

/** Read active taxonomy rows for downstream projections that must hide retired values. */
export async function listActiveJobTaxonomy(): Promise<RecruiterJobTaxonomy | null> {
  try {
    return await readDatabaseTaxonomy();
  } catch {
    return null;
  }
}

/** Return active platform taxonomy, with the bundled taxonomy as a safe boot fallback. */
export async function listRecruiterJobTaxonomy(
  options: Readonly<{ forceRefresh?: boolean }> = {},
): Promise<RecruiterJobTaxonomy> {
  if (options.forceRefresh) {
    // Taxonomy rows are small, so privileged/status-sensitive reads can skip
    // the process-local cache. This is important when the status change was
    // committed by a different application instance.
    const databaseTaxonomy = await readDatabaseTaxonomy().catch(() => null);
    if (databaseTaxonomy) return databaseTaxonomy;
    return staticTaxonomy();
  }

  if (taxonomyCache && taxonomyCache.expiresAt > Date.now()) {
    return taxonomyCache.value;
  }
  taxonomyPromise ??= readDatabaseTaxonomy()
    .catch(() => null)
    .then((databaseTaxonomy) => databaseTaxonomy ?? staticTaxonomy());
  try {
    const value = await taxonomyPromise;
    taxonomyCache = { value, expiresAt: Date.now() + 60_000 };
    return value;
  } finally {
    taxonomyPromise = null;
  }
}

export type TaxonomyResolution = {
  industryId: string;
  industryCode: string;
  industryName: string;
  subIndustryId: string | null;
  subIndustryCode: string | null;
  subIndustryName: string | null;
  categoryIds: string[];
};

type ResolutionInput = {
  industryCode: string;
  industryName: string;
  subIndustryName: string;
  subIndustryId?: string | null;
  subIndustryCode?: string | null;
};

async function findIndustry(db: TaxonomyDb, industryCode: string) {
  const industries = delegate(db, "jobIndustry");
  if (!industries) return null;
  const normalizedCode = industryCode.trim().toLowerCase();
  const code = normalizedCode === "other" ? "r29" : normalizedCode;
  const raw = await industries.findFirst({
    where: { status: "ACTIVE", OR: [{ id: code }, { code }] },
  });
  return raw && typeof raw === "object"
    ? (raw as { id?: unknown; code?: unknown; name?: unknown })
    : null;
}

async function findSubIndustry(
  db: TaxonomyDb,
  industryId: string,
  input: Pick<
    ResolutionInput,
    "subIndustryName" | "subIndustryId" | "subIndustryCode"
  >,
) {
  const subIndustries = delegate(db, "jobSubIndustry");
  if (!subIndustries) return null;
  const ids = [
    input.subIndustryId?.trim(),
    input.subIndustryCode?.trim(),
  ].filter((value): value is string => Boolean(value));
  const normalizedName = normalizeTaxonomyName(input.subIndustryName);
  const raw = await subIndustries.findFirst({
    where: {
      industryId,
      status: "ACTIVE",
      OR: [
        ...ids.flatMap((id) => [{ id }, { code: id }]),
        ...(normalizedName ? [{ normalizedName }] : []),
      ],
    },
  });
  return raw && typeof raw === "object"
    ? (raw as {
        id?: unknown;
        code?: unknown;
        name?: unknown;
        industryId?: unknown;
        status?: unknown;
      })
    : null;
}

function resolutionFromRecords(
  industry: { id: string; code: string; name: string },
  subIndustry: { id: string; code: string; name: string } | null,
  fallback: ResolutionInput,
): TaxonomyResolution {
  return {
    industryId: industry.id,
    industryCode: industry.code,
    industryName: industry.name,
    subIndustryId: subIndustry?.id ?? null,
    subIndustryCode: subIndustry?.code ?? null,
    subIndustryName:
      subIndustry?.name ?? (fallback.subIndustryName.trim() || null),
    categoryIds: subIndustry ? [subIndustry.code] : [],
  };
}

/** Resolve a submitted job to the current shared rows without trusting client IDs. */
export async function resolveJobTaxonomy(
  db: TaxonomyDb,
  input: ResolutionInput,
): Promise<TaxonomyResolution | null> {
  const rawIndustry = await findIndustry(db, input.industryCode);
  if (!rawIndustry) return null;
  const industry = {
    id:
      typeof rawIndustry.id === "string" ? rawIndustry.id : input.industryCode,
    code:
      typeof rawIndustry.code === "string"
        ? rawIndustry.code
        : input.industryCode,
    name:
      typeof rawIndustry.name === "string"
        ? rawIndustry.name
        : input.industryName,
  };
  const rawSubIndustry = await findSubIndustry(db, industry.id, input);
  const subIndustry =
    rawSubIndustry &&
    typeof rawSubIndustry.id === "string" &&
    typeof rawSubIndustry.code === "string" &&
    typeof rawSubIndustry.name === "string"
      ? {
          id: rawSubIndustry.id,
          code: rawSubIndustry.code,
          name: rawSubIndustry.name,
        }
      : null;
  return resolutionFromRecords(industry, subIndustry, input);
}

function proposalDescription(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed.slice(0, 1_000) : null;
}

/** Create the pending proposal only when the submitted name is not already shared. */
export async function createPendingJobTaxonomyProposal(input: {
  db: TaxonomyDb;
  reviewVersionId: string;
  companyId: string;
  requestedByUserId: string;
  industryCode: string;
  industryName: string;
  subIndustryName: string;
  subIndustryId?: string | null;
  subIndustryCode?: string | null;
  description?: string | null;
  now: Date;
}) {
  const proposals = delegate(input.db, "jobTaxonomyProposal");
  if (!proposals) return null;
  const label = input.subIndustryName.trim();
  if (!label) return null;
  const resolution = await resolveJobTaxonomy(input.db, input);
  if (!resolution || resolution.subIndustryId) return null;

  const existing = await proposals.findUnique({
    where: { reviewVersionId: input.reviewVersionId },
  });
  if (existing) return existing;

  const industry = await findIndustry(input.db, input.industryCode);
  if (!industry || typeof industry.id !== "string") return null;
  return proposals.create({
    data: {
      industryId: industry.id,
      companyId: input.companyId,
      requestedByUserId: input.requestedByUserId,
      reviewVersionId: input.reviewVersionId,
      proposedName: label.slice(0, 160),
      normalizedName: normalizeTaxonomyName(label),
      description: proposalDescription(input.description),
      status: "PENDING_APPROVAL",
      createdAt: input.now,
      updatedAt: input.now,
    },
  });
}

function generatedSubIndustryCode(industryCode: string, name: string) {
  const slug = slugifyRecruiterSubIndustry(name);
  const digest = createHash("sha256")
    .update(normalizeTaxonomyName(name))
    .digest("hex")
    .slice(0, 10);
  const base = slug ? `${industryCode}-${slug}` : `${industryCode}-custom`;
  return `${base.slice(0, 117)}-${digest}`.slice(0, 128);
}

/** Promote/map a proposal inside the same transaction as public job approval. */
export async function resolveApprovedJobTaxonomy(input: {
  db: TaxonomyDb;
  reviewVersionId: string;
  industryCode: string;
  industryName: string;
  subIndustryName: string;
  subIndustryId?: string | null;
  subIndustryCode?: string | null;
  adminUserId: string;
  now: Date;
}): Promise<TaxonomyResolution | null> {
  const proposals = delegate(input.db, "jobTaxonomyProposal");
  const industries = delegate(input.db, "jobIndustry");
  const subIndustries = delegate(input.db, "jobSubIndustry");
  if (!proposals || !industries || !subIndustries) {
    return resolveJobTaxonomy(input.db, input);
  }

  const baseResolution = await resolveJobTaxonomy(input.db, input);
  const rawIndustry = await findIndustry(input.db, input.industryCode);
  if (!rawIndustry || typeof rawIndustry.id !== "string") return baseResolution;
  const industry = {
    id: rawIndustry.id,
    code:
      typeof rawIndustry.code === "string"
        ? rawIndustry.code
        : input.industryCode,
    name:
      typeof rawIndustry.name === "string"
        ? rawIndustry.name
        : input.industryName,
  };
  const rawProposal = await proposals.findUnique({
    where: { reviewVersionId: input.reviewVersionId },
  });
  const parsedProposal = dbProposalSchema.safeParse(rawProposal);

  // Another approval may have promoted the same normalized name already.
  // Keep this proposal's audit state in sync while reusing the shared value.
  if (baseResolution?.subIndustryId) {
    if (
      parsedProposal.success &&
      parsedProposal.data.status === "PENDING_APPROVAL"
    ) {
      await proposals.update({
        where: { id: parsedProposal.data.id },
        data: {
          status: "MAPPED",
          resolvedSubIndustryId: baseResolution.subIndustryId,
          reviewedByAdminUserId: input.adminUserId,
          reviewedAt: input.now,
          reviewReason: null,
          updatedAt: input.now,
        },
      });
    }
    return baseResolution;
  }

  if (!parsedProposal.success || parsedProposal.data.status === "REJECTED") {
    return baseResolution;
  }

  const normalizedName = normalizeTaxonomyName(
    parsedProposal.data.proposedName,
  );
  const existing = await subIndustries.findFirst({
    where: { industryId: industry.id, normalizedName },
  });
  const existingRecord =
    existing && typeof existing === "object"
      ? (existing as {
          id?: unknown;
          code?: unknown;
          name?: unknown;
          status?: unknown;
        })
      : null;

  // A removed value is retired, not a valid target for a new approved job.
  // Keep the job approval itself independent from the retired lookup row and
  // close the proposal explicitly so it cannot remain pending forever.
  if (existingRecord?.status === "REMOVED") {
    if (parsedProposal.data.status === "PENDING_APPROVAL") {
      await proposals.update({
        where: { id: parsedProposal.data.id },
        data: {
          status: "REJECTED",
          reviewedByAdminUserId: input.adminUserId,
          reviewedAt: input.now,
          reviewReason:
            "This shared sub-industry was removed by an administrator.",
          updatedAt: input.now,
        },
      });
    }
    return baseResolution;
  }

  let resolved =
    existingRecord &&
    typeof existingRecord.id === "string" &&
    typeof existingRecord.code === "string" &&
    typeof existingRecord.name === "string"
      ? {
          id: existingRecord.id,
          code: existingRecord.code,
          name: existingRecord.name,
        }
      : null;
  let proposalStatus: "APPROVED" | "MAPPED" = "APPROVED";
  let industryVersionChanged = false;

  if (resolved?.id) {
    proposalStatus = "MAPPED";
    // An administrator's deactivation is authoritative. A later approved
    // job may still retain the inactive shared id for historical/search
    // continuity, but it must not silently re-publish the option to forms.
  } else {
    industryVersionChanged = true;
    const code = generatedSubIndustryCode(
      industry.code,
      parsedProposal.data.proposedName,
    );
    const upserted = await subIndustries.upsert({
      where: {
        industryId_normalizedName: {
          industryId: industry.id,
          normalizedName,
        },
      },
      create: {
        id: code,
        industryId: industry.id,
        code,
        name: parsedProposal.data.proposedName.slice(0, 160),
        normalizedName,
        status: "ACTIVE",
        sortOrder: 10_000,
        version: 1,
        createdAt: input.now,
        updatedAt: input.now,
      },
      update: {
        status: "ACTIVE",
        version: { increment: 1 },
        updatedAt: input.now,
      },
    });
    if (upserted && typeof upserted === "object") {
      const record = upserted as {
        id?: unknown;
        code?: unknown;
        name?: unknown;
      };
      if (
        typeof record.id === "string" &&
        typeof record.code === "string" &&
        typeof record.name === "string"
      ) {
        resolved = { id: record.id, code: record.code, name: record.name };
        if (existingRecord) proposalStatus = "MAPPED";
      }
    }
  }

  if (!resolved) return baseResolution;
  if (industryVersionChanged) {
    await industries.update({
      where: { id: industry.id },
      data: { version: { increment: 1 }, updatedAt: input.now },
    });
  }
  await proposals.update({
    where: { id: parsedProposal.data.id },
    data: {
      status: proposalStatus,
      resolvedSubIndustryId: resolved.id,
      reviewedByAdminUserId: input.adminUserId,
      reviewedAt: input.now,
      reviewReason: null,
      updatedAt: input.now,
    },
  });
  return resolutionFromRecords(industry, resolved, input);
}

export async function rejectJobTaxonomyProposal(input: {
  db: TaxonomyDb;
  reviewVersionId: string;
  adminUserId: string;
  reason: string | null;
  now: Date;
}) {
  const proposals = delegate(input.db, "jobTaxonomyProposal");
  if (!proposals) return null;
  const proposal = await proposals.findUnique({
    where: { reviewVersionId: input.reviewVersionId },
  });
  const parsed = dbProposalSchema.safeParse(proposal);
  if (!parsed.success || parsed.data.status !== "PENDING_APPROVAL")
    return proposal;
  const result = await proposals.update({
    where: { id: parsed.data.id },
    data: {
      status: "REJECTED",
      reviewedByAdminUserId: input.adminUserId,
      reviewedAt: input.now,
      reviewReason: input.reason?.trim().slice(0, 1_000) || null,
      updatedAt: input.now,
    },
  });
  return result;
}
