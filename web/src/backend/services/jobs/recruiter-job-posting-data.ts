import "server-only";

import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import {
  companyCatalogSchema,
  jobCatalogSchema,
  jobPostingStatusSchema,
  type CompanyCatalogItem,
  type JobCatalogItem,
  type JobPostingStatus,
} from "@/shared/contracts/jobs/catalog";
import type {
  RecruiterJob,
  RecruiterJobManagementData,
} from "@/shared/contracts/recruiter-job-posting";

const dataPath = (name: string) => resolve(process.cwd(), "data", "jobs", name);
const jobsPath = dataPath("jobs.json");
const companiesPath = dataPath("companies.json");
const applicationsPath = dataPath("applications.json");

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
type RecruiterCompany = CompanyCatalogItem & { ownerUserId: string | null };

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

function withWriteLock<T>(operation: () => Promise<T>) {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
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
  return { ...company, ownerUserId: company.ownerUserId ?? null };
}

async function readCatalog() {
  const [jobsValue, companiesValue] = await Promise.all([
    readJson(jobsPath),
    readJson(companiesPath),
  ]);
  const rawJobs = z.array(z.unknown()).parse(jobsValue);
  const rawCompanies = z.array(z.unknown()).parse(companiesValue);
  const jobs = rawJobs.map(normalizeJob);
  const companies = rawCompanies.map(normalizeCompany);
  return { jobs, companies, rawJobs, rawCompanies };
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

async function readApplications(): Promise<JobApplicationRecord[]> {
  try {
    const value = await readJson(applicationsPath);
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

function ownedCompany(companies: RecruiterCompany[], userId: string) {
  return companies.find((company) => company.ownerUserId === userId) ?? null;
}

export async function readRecruiterJobManagementData(
  userId: string,
): Promise<RecruiterJobManagementData> {
  const { jobs, companies } = await readCatalog();
  const ownedCompanies = companies.filter(
    (company) => company.ownerUserId === userId,
  );
  const ownedCompanyIds = new Set(ownedCompanies.map((company) => company.id));
  const companyById = new Map(
    companies.map((company) => [company.id, company]),
  );
  const recruiterJobs: RecruiterJob[] = jobs
    .filter((job) => ownedCompanyIds.has(job.companyId))
    .map((job) => ({ ...job, company: companyById.get(job.companyId)! }))
    .filter((job) => job.company !== undefined);

  return {
    jobs: recruiterJobs,
    companies: ownedCompanies,
    companyId: ownedCompanies[0]?.id ?? null,
  };
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
  status: Extract<JobPostingStatus, "draft" | "pending_approval">,
) {
  return withWriteLock(async () => {
    const { companies, rawJobs } = await readCatalog();
    const company = ownedCompany(companies, userId);
    if (!company) throw new Error("A recruiter-owned company is required.");
    const now = new Date().toISOString();
    const job = jobFromCommand(raw, company.id, status, now);
    await writeJson(jobsPath, [...rawJobs, job]);
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
  if (current === "active") return target === "active";
  if (current === "closed") return target === "closed";
  return false;
}
export async function updateRecruiterJob(userId: string, raw: unknown) {
  return withWriteLock(async () => {
    const { jobs, companies, rawJobs } = await readCatalog();
    const company = ownedCompany(companies, userId);
    if (!company) throw new Error("A recruiter-owned company is required.");
    const input = normalizeJob(raw);
    const current = jobs.find(
      (job) => job.id === input.id && job.companyId === company.id,
    );
    if (!current) throw new Error("Job posting not found.");
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
      postedAt: current.postedAt,
      updatedAt: now,
      stats: {
        viewCount: current.stats.viewCount,
        applicantCount: current.stats.applicantCount,
      },
    });
    await writeJson(jobsPath, replaceRawJob(rawJobs, updated));
    return { ...updated, company } satisfies RecruiterJob;
  });
}

export async function closeRecruiterJob(userId: string, jobId: string) {
  return withWriteLock(async () => {
    const { jobs, companies, rawJobs } = await readCatalog();
    const company = ownedCompany(companies, userId);
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
    const updated = jobCatalogSchema.parse({
      ...current,
      status: "closed",
      updatedAt: new Date().toISOString(),
    });
    await writeJson(jobsPath, replaceRawJob(rawJobs, updated));
    return { ...updated, company } satisfies RecruiterJob;
  });
}

export async function ensureRecruiterCompany(
  userId: string,
  input: Pick<CompanyCatalogItem, "name" | "industry" | "address">,
) {
  return withWriteLock(async () => {
    const { companies, rawCompanies } = await readCatalog();
    const existing = ownedCompany(companies, userId);
    if (existing) return existing;
    const id = `comp-${randomUUID()}`;
    const company = companyCatalogSchema.parse({
      id,
      slug: `${slugPart(input.name)}-${id.slice(-8)}`,
      name: input.name,
      logo: null,
      size: "1-50 employees",
      industry: input.industry,
      address: input.address,
      website: null,
      description: null,
      ownerUserId: userId,
      jobCount: 0,
    });
    await writeJson(companiesPath, [...rawCompanies, company]);
    return { ...company, ownerUserId: userId } satisfies RecruiterCompany;
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
    await writeJson(jobsPath, replaceRawJob(rawJobs, updated));
    await writeJson(applicationsPath, [
      ...applications,
      {
        id: `application-${randomUUID()}`,
        jobId,
        userId,
        appliedAt: new Date().toISOString(),
        status,
      },
    ] satisfies JobApplicationRecord[]);
    return updated;
  });
}
