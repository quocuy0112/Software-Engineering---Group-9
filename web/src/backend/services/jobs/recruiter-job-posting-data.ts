import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/backend/database/prisma";
import { configuredJsonJobCatalogueRepository } from "@/backend/repositories/jobs/job-catalogue-repository-factory";
import { adoptActiveJobBaseline } from "@/backend/jobs/review/job-post-active-baseline-service";
import { closeManagedJobPost } from "@/backend/jobs/review/job-post-review-service";
import {
  companyCatalogSchema,
  recruiterCompanySettingsInputSchema,
  jobCatalogSchema,
  jobPostingStatusSchema,
  type CompanyCatalogItem,
  type JobCatalogItem,
  type RecruiterCompanySettings,
  type RecruiterCompanySettingsInput,
  type JobPostingStatus,
} from "@/shared/contracts/jobs/catalog";
import { splitCompanyIdentity } from "@/shared/contracts/employer-verification/business-verification";
import type {
  RecruiterJob,
  RecruiterJobManagementData,
} from "@/shared/contracts/recruiter-job-posting";

const jobsRepository = configuredJsonJobCatalogueRepository("jobs.json");
const companiesRepository =
  configuredJsonJobCatalogueRepository("companies.json");
const applicationsRepository =
  configuredJsonJobCatalogueRepository("applications.json");
const MAX_COMPANY_LOGO_BYTES = 800 * 1024;
type CompanyProfileField =
  RecruiterCompanySettings["missingProfileFields"][number];

const noCompanyProfileFields: CompanyProfileField[] = [
  "name",
  "industry",
  "size",
  "address",
  "logo",
];

function missingCompanyProfileFields(
  company: Pick<
    CompanyCatalogItem,
    "name" | "industry" | "size" | "address" | "logo"
  >,
): CompanyProfileField[] {
  const required = [
    ["name", company.name],
    ["industry", company.industry],
    ["size", company.size],
    ["address", company.address],
    ["logo", company.logo],
  ] as const;
  return required
    .filter(
      ([, value]) => typeof value !== "string" || value.trim().length === 0,
    )
    .map(([field]) => field);
}

function isPng(bytes: Buffer) {
  return bytes
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

function isJpeg(bytes: Buffer) {
  return (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes.at(-2) === 0xff &&
    bytes.at(-1) === 0xd9
  );
}

function isWebp(bytes: Buffer) {
  return (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function validateCompanyLogo(logo: string | null) {
  if (!logo?.startsWith("data:")) return;
  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/u.exec(logo);
  if (!match) throw new Error("Invalid company logo.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_COMPANY_LOGO_BYTES) {
    throw new Error("Invalid company logo.");
  }
  const valid =
    match[1] === "png"
      ? isPng(bytes)
      : match[1] === "jpeg"
        ? isJpeg(bytes)
        : isWebp(bytes);
  if (!valid) throw new Error("Invalid company logo.");
}

const legacyStatusSchema = z.enum([
  "open",
  "closing_soon",
  "filled",
  "expired",
]);
const sourceJobSchema = jobCatalogSchema
  .omit({ status: true })
  .extend({ status: z.string().min(1) })
  .passthrough();
const applicationSchema = z
  .object({
    id: z.string().min(1),
    jobId: z.string().min(1),
    userId: z.string().min(1),
    appliedAt: z.string().datetime(),
    status: z.string().min(1),
  })
  .strict();

type JobApplicationRecord = z.infer<typeof applicationSchema>;
type RecruiterCompany = CompanyCatalogItem & {
  ownerUserId: string | null;
  memberUserIds: string[];
  /** The persistent company id when the catalog id is a legacy JSON id. */
  databaseId?: string;
  databaseBacked?: boolean;
};

const legacyStatusMap: Record<
  z.infer<typeof legacyStatusSchema>,
  JobPostingStatus
> = {
  open: "active",
  closing_soon: "active",
  filled: "closed",
  expired: "closed",
};

let writeQueue: Promise<void> = Promise.resolve();
type RecruiterCatalog = {
  jobs: JobCatalogItem[];
  companies: RecruiterCompany[];
  rawJobs: unknown[];
  rawCompanies: unknown[];
};
let catalogRead: Promise<RecruiterCatalog> | null = null;

function withWriteLock<T>(operation: () => Promise<T>) {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function normalizedStatus(value: string): JobPostingStatus {
  const legacy = legacyStatusSchema.safeParse(value);
  return legacy.success
    ? legacyStatusMap[legacy.data]
    : jobPostingStatusSchema.parse(value);
}

function normalizeJob(value: unknown): JobCatalogItem {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : value;

  if (candidate && typeof candidate === "object") {
    delete (candidate as Record<string, unknown>).company;
  }

  const source = sourceJobSchema.parse(candidate);
  return jobCatalogSchema.parse({
    ...source,
    status: normalizedStatus(source.status),
  });
}

function normalizeCompany(value: unknown): RecruiterCompany {
  const company = companyCatalogSchema.parse(value);
  const identity = splitCompanyIdentity(company.name, company.entityType);
  return {
    ...company,
    name: identity.name,
    entityType: identity.entityType,
    ownerUserId: company.ownerUserId ?? null,
    memberUserIds: company.memberUserIds ?? [],
  };
}

type DatabaseCompanyRow = {
  id: string;
  slug: string;
  legalName: string;
  displayName: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  publicDescription: string | null;
  publicLocation: string | null;
  size: string | null;
  industry: string | null;
  address: string | null;
  entityType: string | null;
  normalizedTaxIdentifier: string | null;
  memberships: Array<{ userId: string; role: string }>;
};

function databaseCompanyToRecruiterCompany(
  company: DatabaseCompanyRow,
  catalogCompany?: RecruiterCompany,
): RecruiterCompany {
  const owner = company.memberships.find(
    (membership) => membership.role === "OWNER",
  );
  const legalIdentity = splitCompanyIdentity(company.legalName);
  const identity = splitCompanyIdentity(
    company.displayName || company.legalName,
    company.entityType ??
      catalogCompany?.entityType ??
      legalIdentity.entityType,
  );
  const databaseCompany: RecruiterCompany = {
    // Keep the legacy catalog id when the company is already represented in
    // jobs.json. Jobs are still stored in that catalog, while auth and
    // verification remain authoritative in PostgreSQL.
    id: catalogCompany?.id ?? company.id,
    slug: catalogCompany?.slug ?? company.slug,
    name: identity.name,
    entityType: identity.entityType,
    logo: company.logoUrl ?? catalogCompany?.logo ?? null,
    size: company.size ?? "",
    industry: company.industry ?? "",
    address: company.address ?? company.publicLocation ?? "",
    website: company.websiteUrl ?? null,
    description: company.publicDescription ?? null,
    ownerUserId: owner?.userId ?? null,
    memberUserIds: company.memberships.map((membership) => membership.userId),
    taxCode:
      company.normalizedTaxIdentifier ??
      catalogCompany?.taxCode ??
      "Not provided",
    verificationStatus: "approved",
    databaseId: company.id,
    databaseBacked: true,
  };

  return databaseCompany;
}

async function readDatabaseAuthorizedCompanies(userId: string) {
  try {
    return await prisma.company.findMany({
      where: {
        verificationState: "ACTIVE",
        verifiedAt: { not: null },
        memberships: {
          some: { userId, status: "ACTIVE" },
        },
      },
      select: {
        id: true,
        slug: true,
        legalName: true,
        displayName: true,
        logoUrl: true,
        websiteUrl: true,
        publicDescription: true,
        publicLocation: true,
        size: true,
        industry: true,
        address: true,
        entityType: true,
        normalizedTaxIdentifier: true,
        memberships: {
          where: { status: "ACTIVE" },
          select: { userId: true, role: true },
        },
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
    });
  } catch {
    // The JSON catalog remains a compatibility source for legacy local data.
    // A database-backed company is only added when its authorization can be
    // read successfully, so a transient database failure cannot grant new
    // access through this bridge.
    return [];
  }
}

async function authorizedCompanies(
  companies: RecruiterCompany[],
  userId: string,
) {
  const databaseCompanies = await readDatabaseAuthorizedCompanies(userId);
  const byTaxCode = new Map(
    companies
      .filter((company) => company.taxCode)
      .map((company) => [company.taxCode, company]),
  );
  const databaseViews = databaseCompanies.map((company) =>
    databaseCompanyToRecruiterCompany(
      company,
      byTaxCode.get(company.normalizedTaxIdentifier ?? ""),
    ),
  );
  const databaseIds = new Set(databaseViews.map((company) => company.id));
  const legacyAuthorized = companies.filter(
    (company) =>
      !databaseIds.has(company.id) &&
      company.verificationStatus === "approved" &&
      (company.ownerUserId === userId ||
        company.memberUserIds.includes(userId)),
  );
  return [...databaseViews, ...legacyAuthorized];
}

async function readCatalog() {
  if (catalogRead) return catalogRead;

  catalogRead = Promise.all([jobsRepository.read(), companiesRepository.read()])
    .then(([jobsValue, companiesValue]) => {
      const rawJobs = z.array(z.unknown()).parse(jobsValue);
      const rawCompanies = z.array(z.unknown()).parse(companiesValue);
      const jobs = rawJobs.map(normalizeJob);
      const companies = rawCompanies.map(normalizeCompany);
      return { jobs, companies, rawJobs, rawCompanies };
    })
    .then((catalog) => catalog);
  try {
    return await catalogRead;
  } finally {
    catalogRead = null;
  }
}

export async function authorizeLegacyRecruiterJobs(
  userId: string,
  jobIds: readonly string[],
) {
  const requestedJobIds = new Set(jobIds);
  const authorized = new Map<
    string,
    { jobId: string; companyId: string; jobTitle: string }
  >();
  if (requestedJobIds.size === 0) return authorized;

  const { jobs, companies } = await readCatalog();
  const databaseCompanies = await readDatabaseAuthorizedCompanies(userId);
  const databaseCompanyIds = new Set(
    databaseCompanies.map((company) => company.id),
  );
  const databaseCompanyIdsByTaxCode = new Set(
    databaseCompanies
      .map((company) => company.normalizedTaxIdentifier)
      .filter((taxCode): taxCode is string => Boolean(taxCode)),
  );
  const companyById = new Map(
    companies.map((company) => [company.id, company]),
  );
  for (const job of jobs) {
    if (!requestedJobIds.has(job.id)) continue;
    const company = companyById.get(job.companyId);
    const companyAuthorizedByDatabase = Boolean(
      databaseCompanyIds.has(job.companyId) ||
      (company &&
        (databaseCompanyIds.has(company.id) ||
          (company.taxCode &&
            databaseCompanyIdsByTaxCode.has(company.taxCode)))),
    );
    if (
      (!company && !databaseCompanyIds.has(job.companyId)) ||
      (company &&
        !companyAuthorizedByDatabase &&
        (company.verificationStatus !== "approved" ||
          (company.ownerUserId !== userId &&
            !company.memberUserIds.includes(userId))))
    )
      continue;
    authorized.set(job.id, {
      jobId: job.id,
      companyId: company?.id ?? job.companyId,
      jobTitle: job.title,
    });
  }
  return authorized;
}

export async function authorizeLegacyRecruiterJob(
  userId: string,
  jobId: string,
) {
  return (
    (await authorizeLegacyRecruiterJobs(userId, [jobId])).get(jobId) ?? null
  );
}

function replaceRawJob(rawJobs: unknown[], updated: JobCatalogItem) {
  let replaced = false;
  const next = rawJobs.map((value) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).id === updated.id
    ) {
      replaced = true;
      return updated;
    }
    return value;
  });
  if (!replaced) throw new Error("Job posting not found.");
  return next;
}

function replaceOrAppendRawCompany(
  rawCompanies: unknown[],
  updated: CompanyCatalogItem,
) {
  let replaced = false;
  const next = rawCompanies.map((value) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).id === updated.id
    ) {
      replaced = true;
      return updated;
    }
    return value;
  });

  if (!replaced) next.push(updated);
  return next;
}

async function readApplications(): Promise<JobApplicationRecord[]> {
  try {
    const value = await applicationsRepository.read();
    return z.array(applicationSchema).parse(value);
  } catch {
    return [];
  }
}

export async function readMockAppliedJobIds(userId: string) {
  const applications = await readApplications();
  return applications
    .filter((application) => application.userId === userId)
    .map((application) => application.jobId);
}

export async function readRecruiterJobManagementData(
  userId: string,
): Promise<RecruiterJobManagementData> {
  const { jobs, companies } = await readCatalog();
  const ownedCompanies = await authorizedCompanies(companies, userId);
  const ownedCompanyIds = new Set(ownedCompanies.map((company) => company.id));
  const companyById = new Map(
    [...companies, ...ownedCompanies].map((company) => [company.id, company]),
  );
  const ownedJobIds = jobs
    .filter((job) => ownedCompanyIds.has(job.companyId))
    .map((job) => job.id);
  const reviewAggregates = ownedJobIds.length
    ? await prisma.jobPostReviewAggregate.findMany({
        where: { jobId: { in: ownedJobIds } },
        include: {
          pendingVersion: true,
          versions: { orderBy: { sequence: "desc" }, take: 1 },
          correctionRequests: {
            where: { state: "OPEN" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      })
    : [];
  const reviewByJobId = new Map(
    reviewAggregates.map((aggregate) => [aggregate.jobId, aggregate]),
  );
  const recruiterJobs: RecruiterJob[] = jobs
    .filter((job) => ownedCompanyIds.has(job.companyId))
    .map((job) => {
      const aggregate = reviewByJobId.get(job.id);
      const current = aggregate?.pendingVersion ?? aggregate?.versions[0];
      const correctionRequest = aggregate?.correctionRequests[0];
      const derivedStatus = aggregate?.pendingVersion
        ? "pending_approval"
        : current?.state === "REJECTED"
          ? "rejected"
          : current?.state === "APPROVED"
            ? "active"
            : job.status;
      return {
        ...job,
        status: derivedStatus,
        company: companyById.get(job.companyId)!,
        ...(aggregate && current
          ? {
              review: {
                reviewId: current.id,
                jobId: aggregate.jobId,
                sequence: current.sequence,
                state: current.state,
                readOnly: current.state === "PENDING_REVIEW",
                reasonCode: current.reasonCode,
                publicExplanation: current.publicExplanation,
                submittedAt: current.submittedAt.toISOString(),
                decidedAt: current.decidedAt?.toISOString() ?? null,
                version: aggregate.version,
              },
            }
          : {}),
        ...(correctionRequest
          ? {
              correctionRequest: {
                id: correctionRequest.id,
                publicExplanation: correctionRequest.publicExplanation,
                hideImmediately: correctionRequest.hideImmediately,
                createdAt: correctionRequest.createdAt.toISOString(),
              },
            }
          : {}),
      };
    })
    .filter((job) => job.company !== undefined);

  const primaryCompany = ownedCompanies[0] ?? null;
  const missingProfileFields = primaryCompany
    ? missingCompanyProfileFields(primaryCompany)
    : noCompanyProfileFields;

  return {
    jobs: recruiterJobs,
    companies: ownedCompanies,
    companyId: primaryCompany?.id ?? null,
    companyProfileComplete: Boolean(
      primaryCompany && missingProfileFields.length === 0,
    ),
    missingCompanyProfileFields: missingProfileFields,
  };
}

export async function readRecruiterJobReviewSource(
  userId: string,
  jobId: string,
) {
  const { jobs, companies } = await readCatalog();
  const authorized = await authorizedCompanies(companies, userId);
  const companyById = new Map(
    authorized.map((company) => [company.id, company]),
  );
  const job = jobs.find((candidate) => candidate.id === jobId);
  const company = job ? companyById.get(job.companyId) : undefined;
  if (!job || !company?.databaseBacked || !company.databaseId)
    throw new Error("JOB_POST_REVIEW_UNAVAILABLE");
  const membership = await prisma.companyMembership.findFirst({
    where: {
      companyId: company.databaseId,
      userId,
      status: "ACTIVE",
      role: { in: ["OWNER", "HR_MANAGER", "RECRUITER", "HIRING_MANAGER"] },
      user: { state: "ACTIVE", deletedAt: null },
      company: {
        verificationState: "ACTIVE",
        verifiedAt: { not: null },
        verificationInactiveAt: null,
      },
    },
    select: { id: true, companyId: true },
  });
  if (!membership) throw new Error("JOB_POST_REVIEW_UNAVAILABLE");
  return { job, membership };
}

function slugPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 80);
}

function buildJobId() {
  return `job-${randomUUID()}`;
}

function jobFromCommand(
  raw: unknown,
  companyId: string,
  status: JobPostingStatus,
  now: string,
  id = buildJobId(),
): JobCatalogItem {
  const input = normalizeJob(raw);
  const title = input.title.trim();
  if (!title) throw new Error("A job title is required.");
  const locationPart = input.location.city || "remote";
  return jobCatalogSchema.parse({
    ...input,
    id,
    slug: `${slugPart(title)}-${slugPart(locationPart)}-${id.slice(-8)}`,
    companyId,
    status,
    approvalComment: input.approvalComment ?? null,
    postedAt: input.postedAt || now,
    updatedAt: now,
    stats: {
      viewCount: input.stats.viewCount ?? 0,
      applicantCount: input.stats.applicantCount ?? 0,
    },
  });
}

export async function createRecruiterJob(
  userId: string,
  raw: unknown,
  status: Extract<JobPostingStatus, "draft">,
) {
  return withWriteLock(async () => {
    const { companies, rawJobs } = await readCatalog();
    const company = (await authorizedCompanies(companies, userId))[0] ?? null;
    if (!company) throw new Error("A recruiter-owned company is required.");
    const now = new Date().toISOString();
    const missingProfileFields = missingCompanyProfileFields(company);
    if (missingProfileFields.length) {
      throw new Error("Company profile is incomplete.");
    }
    const job = jobFromCommand(raw, company.id, status, now);
    await jobsRepository.mutate(() => [...rawJobs, job]);
    return { ...job, company } satisfies RecruiterJob;
  });
}

function recruiterCanUpdateStatus(
  current: JobPostingStatus,
  target: JobPostingStatus,
) {
  if (current === "draft" || current === "rejected") {
    return target === "draft" || target === "pending_approval";
  }
  if (current === "active") return target === "active" || target === "draft";
  if (current === "closed") return target === "closed";
  return false;
}
export async function updateRecruiterJob(userId: string, raw: unknown) {
  return withWriteLock(async () => {
    const { jobs, companies, rawJobs } = await readCatalog();
    const company = (await authorizedCompanies(companies, userId))[0] ?? null;
    if (!company) throw new Error("A recruiter-owned company is required.");
    const input = normalizeJob(raw);
    const current = jobs.find(
      (job) => job.id === input.id && job.companyId === company.id,
    );
    if (!current) throw new Error("Job posting not found.");
    const reviewLock = await prisma.jobPostReviewAggregate.findUnique({
      where: { jobId: current.id },
      select: { pendingVersionId: true },
    });
    if (reviewLock?.pendingVersionId)
      throw new Error("This job posting is locked while review is pending.");
    if (current.status === "active" && input.status === "draft") {
      if (!company.databaseBacked || !company.databaseId)
        throw new Error("JOB_POST_REVIEW_UNAVAILABLE");
      await adoptActiveJobBaseline({
        job: current,
        authoritativeCompanyId: company.databaseId,
        actorUserId: userId,
      });
    }
    if (!recruiterCanUpdateStatus(current.status, input.status)) {
      throw new Error(
        "This job posting cannot be edited in its current status.",
      );
    }
    const now = new Date().toISOString();
    const updated = jobCatalogSchema.parse({
      ...input,
      id: current.id,
      slug: current.slug,
      companyId: current.companyId,
      approvalComment: input.approvalComment ?? current.approvalComment ?? null,
      postedAt: current.postedAt,
      updatedAt: now,
      stats: {
        viewCount: current.stats.viewCount,
        applicantCount: current.stats.applicantCount,
      },
    });
    await jobsRepository.mutate(() => replaceRawJob(rawJobs, updated));
    return { ...updated, company } satisfies RecruiterJob;
  });
}

export async function closeRecruiterJob(userId: string, jobId: string) {
  return withWriteLock(async () => {
    const { jobs, companies, rawJobs } = await readCatalog();
    const company = (await authorizedCompanies(companies, userId))[0] ?? null;
    if (!company) throw new Error("A recruiter-owned company is required.");
    const current = jobs.find(
      (job) => job.id === jobId && job.companyId === company.id,
    );
    if (!current) throw new Error("Job posting not found.");
    if (current.status !== "active") {
      throw new Error(
        "This job posting cannot be closed in its current status.",
      );
    }
    if (company.databaseBacked && company.databaseId)
      await closeManagedJobPost({
        jobId: current.id,
        companyId: company.databaseId,
        actorUserId: userId,
      });
    const updated = jobCatalogSchema.parse({
      ...current,
      status: "closed",
      updatedAt: new Date().toISOString(),
    });
    await jobsRepository.mutate(() => replaceRawJob(rawJobs, updated));
    return { ...updated, company } satisfies RecruiterJob;
  });
}

export async function ensureRecruiterCompany(
  userId: string,
  input: Pick<CompanyCatalogItem, "name" | "industry" | "address">,
) {
  return withWriteLock(async () => {
    const { companies, rawCompanies } = await readCatalog();
    const existing = (await authorizedCompanies(companies, userId))[0] ?? null;
    if (existing) return existing;
    const id = `comp-${randomUUID()}`;
    const identity = splitCompanyIdentity(input.name);
    const company = companyCatalogSchema.parse({
      id,
      slug: `${slugPart(identity.name)}-${id.slice(-8)}`,
      name: identity.name,
      entityType: identity.entityType,
      logo: null,
      size: "1-50 employees",
      industry: input.industry,
      address: input.address,
      website: null,
      description: null,
      ownerUserId: userId,
      memberUserIds: [],
      taxCode: "0000000000",
      verificationStatus: "pending",
      jobCount: 0,
    });
    await companiesRepository.mutate(() => [...rawCompanies, company]);
    return { ...company, ownerUserId: userId } satisfies RecruiterCompany;
  });
}

function settingsFromCompany(
  company: RecruiterCompany,
): RecruiterCompanySettings {
  return {
    id: company.id,
    slug: company.slug,
    name: company.name,
    entityType: company.entityType ?? null,
    logo: company.logo,
    size: company.size,
    industry: company.industry,
    address: company.address,
    website: company.website,
    description: company.description,
    ownerUserId: company.ownerUserId,
    memberUserIds: company.memberUserIds,
    taxCode: company.taxCode,
    verificationStatus: company.verificationStatus,
    profileComplete: missingCompanyProfileFields(company).length === 0,
    missingProfileFields: missingCompanyProfileFields(company),
  };
}

export async function readRecruiterCompanySettings(userId: string) {
  const { companies } = await readCatalog();
  const company = (await authorizedCompanies(companies, userId))[0] ?? null;
  return company ? settingsFromCompany(company) : null;
}

export async function updateRecruiterCompanySettings(
  userId: string,
  input: RecruiterCompanySettingsInput,
) {
  return withWriteLock(async () => {
    const { companies, rawCompanies } = await readCatalog();
    const company = (await authorizedCompanies(companies, userId))[0] ?? null;
    if (!company) throw new Error("Recruiter company not found.");
    const editable = recruiterCompanySettingsInputSchema.parse(input);
    validateCompanyLogo(editable.logo);
    const identity = splitCompanyIdentity(
      company.verificationStatus === "approved" ? company.name : editable.name,
      company.entityType,
    );
    // These fields identify the PostgreSQL bridge and are not part of the
    // strict public catalog contract. Strip them before parsing the updated
    // catalog record, otherwise every DB-backed company save fails with an
    // object-level Zod error.
    const catalogCompany = { ...company };
    delete catalogCompany.databaseId;
    delete catalogCompany.databaseBacked;
    const updated = companyCatalogSchema.parse({
      ...catalogCompany,
      name: identity.name,
      entityType: identity.entityType,
      logo: editable.logo,
      size: editable.size,
      industry: editable.industry,
      address: editable.address,
      website: editable.website,
      description: editable.description,
    });
    await companiesRepository.mutate(() =>
      replaceOrAppendRawCompany(rawCompanies, updated),
    );
    if (company.databaseBacked && company.databaseId) {
      await prisma.company.update({
        where: { id: company.databaseId },
        data: {
          displayName: updated.name,
          entityType: updated.entityType,
          logoUrl: updated.logo,
          size: updated.size,
          industry: updated.industry,
          address: updated.address,
          websiteUrl: updated.website,
          publicDescription: updated.description,
          publicLocation: updated.address,
        },
      });
    }
    return settingsFromCompany({
      ...updated,
      ownerUserId: updated.ownerUserId ?? null,
      memberUserIds: updated.memberUserIds,
    });
  });
}

export async function recordApplication(
  userId: string,
  jobId: string,
  status = "applied",
) {
  return withWriteLock(async () => {
    const { jobs, rawJobs } = await readCatalog();
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (!job) throw new Error("Job posting not found.");
    const applications = await readApplications();
    const alreadyApplied = applications.some(
      (application) =>
        application.jobId === jobId && application.userId === userId,
    );
    if (alreadyApplied) return job;
    const updated = jobCatalogSchema.parse({
      ...job,
      stats: {
        ...job.stats,
        applicantCount: job.stats.applicantCount + 1,
      },
    });
    await jobsRepository.mutate(() => replaceRawJob(rawJobs, updated));
    await applicationsRepository.mutate(
      () =>
        [
          ...applications,
          {
            id: `application-${randomUUID()}`,
            jobId,
            userId,
            appliedAt: new Date().toISOString(),
            status,
          },
        ] satisfies JobApplicationRecord[],
    );
    return updated;
  });
}
