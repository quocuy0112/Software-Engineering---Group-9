import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnvironment } from "dotenv";
import { z } from "zod";
import {
  CompanyVerificationState,
  Prisma,
  PrismaClient,
} from "../src/backend/generated/prisma/client";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultCompaniesPath = resolve(webRoot, "data/companies/companies.json");
const defaultJobsPath = resolve(webRoot, "data/jobs/jobs.json");
const bindingQueryBatchSize = 1_000;
const jobBatchSize = 50;
const jobImportConcurrency = 4;
const importTransactionOptions = {
  maxWait: 30_000,
  timeout: 60_000,
} as const;

// The split fixture stores verification at job level, while Prisma stores it
// at company level. A stable date keeps the local demo data deterministic.
const splitFixtureVerificationDate = new Date("2026-01-01T00:00:00.000Z");

loadEnvironment({ path: resolve(webRoot, ".env.local"), quiet: true });

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[đĐ]/gu, "d")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");

const sourceCompanySchema = z.object({
  id: z.string().min(1).max(128),
  slug: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  name: z.string().min(1).max(160),
  logo: z.string().url().nullable(),
  size: z.string().min(1).max(80),
  industry: z.string().min(1).max(160),
  address: z.string().min(1).max(300),
  website: z.string().url().nullable(),
  description: z.string().max(3_000).nullable(),
  ownerUserId: z.string().min(1).max(128).nullable().optional(),
  memberUserIds: z.array(z.string().min(1).max(128)).max(10_000).default([]),
  taxCode: z
    .string()
    .regex(/^\d{10}$/u)
    .optional(),
  verificationStatus: z.enum(["pending", "approved", "rejected"]).optional(),
});

function usableCompanyTaxCode(taxCode: string | undefined): string | undefined {
  // This is the placeholder written for an unverified company. It is not a
  // stable business identity and must not merge two unrelated local rows.
  return taxCode && taxCode !== "0000000000" ? taxCode : undefined;
}

const sourceLocationSchema = z.object({
  city: z.string().min(1).max(160),
  district: z.string().max(160).nullable(),
  isNationwideRemote: z.boolean(),
});

const sourceSalarySchema = z
  .object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
    currency: z.string().regex(/^[A-Z]{3}$/u),
    period: z.enum(["hour", "month", "year"]),
    isNegotiable: z.boolean(),
  })
  .refine(({ min, max }) => min <= max, {
    message: "salary.min must be less than or equal to salary.max",
  });

const sourceDescriptionSchema = z.object({
  overview: z.string().min(1).max(20_000),
  topReasonsToJoin: z.array(z.string().min(1).max(2_000)).max(20),
  responsibilities: z.array(z.string().min(1).max(2_000)).max(100),
  requirements: z.array(z.string().min(1).max(2_000)).max(100),
  benefits: z
    .array(
      z.object({
        icon: z.string().min(1).max(80),
        label: z.string().min(1).max(300),
      }),
    )
    .max(50),
  generalInfo: z.object({
    reportsTo: z.string().max(160).nullable(),
    department: z.string().max(160).nullable(),
    workingHours: z.string().max(300).nullable(),
    workAddress: z.string().max(300).nullable(),
  }),
});

const sourceJobSchema = z.object({
  id: z.string().min(1).max(128),
  slug: z
    .string()
    .min(1)
    .max(220)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  companyId: z.string().min(1).max(128),
  title: z.string().min(1).max(200),
  shortPitch: z.string().min(1).max(500),
  education: z.string().min(1).max(200),
  numberOfHires: z.number().int().positive(),
  age: z.string().min(1).max(80),
  industry: z.string().min(1).max(160),
  /** Shared taxonomy fields are optional for older fixture documents. */
  industryCode: z.string().trim().min(1).max(80).optional(),
  industryId: z.string().trim().min(1).max(80).nullable().optional(),
  subIndustry: z.string().min(1).max(160),
  subIndustryCode: z.string().trim().min(1).max(128).nullable().optional(),
  subIndustryId: z.string().trim().min(1).max(128).nullable().optional(),
  categoryIds: z.array(z.string().trim().min(1).max(128)).max(20).optional(),
  categoryFamily: z.string().trim().min(1).max(80).optional(),
  skillTags: z.array(z.string().min(1).max(80)).max(50),
  location: sourceLocationSchema,
  salary: sourceSalarySchema,
  experience: z.object({
    minYears: z.number().int().nonnegative(),
    label: z.string().min(1).max(80),
  }),
  level: z.enum([
    "intern",
    "staff",
    "senior",
    "team_lead",
    "manager",
    "director",
    "executive",
  ]),
  employmentType: z.enum([
    "full_time",
    "part_time",
    "contract",
    "internship",
    "temporary",
  ]),
  workArrangement: z.enum(["onsite", "hybrid", "remote"]),
  status: z.enum([
    "open",
    "closing_soon",
    "closed",
    "filled",
    "expired",
    "draft",
    "pending_approval",
    "rejected",
    "active",
  ]),
  isVerified: z.boolean(),
  postedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  applyDeadline: z.string().datetime().nullable(),
  description: sourceDescriptionSchema,
});

type SourceCompany = z.infer<typeof sourceCompanySchema>;
type SourceJob = z.infer<typeof sourceJobSchema>;
type JobPostingStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "CLOSED"
  | "EXPIRED"
  | "REJECTED";

type SeedCompanyMembership = {
  userId: string;
  role: "OWNER" | "RECRUITER";
};

type SeedBindings = {
  companyIdBySourceId: ReadonlyMap<string, string>;
  jobIdBySourceId: ReadonlyMap<string, string>;
  remappedCompanyCount: number;
  remappedJobCount: number;
};

function sourceCompanyMemberships(
  company: SourceCompany,
): SeedCompanyMembership[] {
  const userIds = new Set([
    ...company.memberUserIds,
    ...(company.ownerUserId ? [company.ownerUserId] : []),
  ]);
  return [...userIds].map((userId) => ({
    userId,
    // Legacy fixtures do not retain a role for memberUserIds. RECRUITER is
    // the compatible database role for a legacy job-catalogue member; the
    // explicit owner always wins when the same user appears in both lists.
    role: userId === company.ownerUserId ? "OWNER" : "RECRUITER",
  }));
}

function sourceCompanyVerification(
  company: SourceCompany,
  verifiedCompanyIds: ReadonlySet<string>,
) {
  const isVerified = company.verificationStatus
    ? company.verificationStatus === "approved"
    : verifiedCompanyIds.has(company.id);
  return {
    verifiedAt: isVerified ? new Date(splitFixtureVerificationDate) : null,
    verificationState: isVerified
      ? CompanyVerificationState.ACTIVE
      : CompanyVerificationState.UNVERIFIED,
    verificationInactiveAt: null,
  };
}

function argumentPath(flag: string, fallback: string): string {
  const argumentIndex = process.argv.indexOf(flag);
  if (argumentIndex < 0) return fallback;

  const value = process.argv[argumentIndex + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(flag + " requires a path.");
  }
  return resolve(process.cwd(), value);
}

function printUsage() {
  console.log(
    [
      "Usage: tsx scripts/seed-development-jobs.ts [options]",
      "",
      "Options:",
      "  --companies <path>  Company fixture JSON path.",
      "  --jobs <path>       Job fixture JSON path.",
      "  --check             Validate both files without touching the database.",
      "  --help              Show this help.",
    ].join("\n"),
  );
}

async function readJsonFile(path: string, label: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Missing " + label + " fixture file: " + path, {
        cause: error,
      });
    }
    throw error;
  }
}

async function readJobsFixture(path: string): Promise<unknown> {
  try {
    return await readJsonFile(path, "jobs");
  } catch (error) {
    const missingSource =
      path === defaultJobsPath &&
      (error as Error & { cause?: NodeJS.ErrnoException }).cause?.code ===
        "ENOENT";
    if (!missingSource) throw error;

    const entries = await readdir(resolve(webRoot, "data/jobs"), {
      withFileTypes: true,
    });
    const splitPaths = entries
      .filter(
        (entry) => entry.isFile() && /^jobs_.+_r\d{2}\.json$/u.test(entry.name),
      )
      .map((entry) => resolve(webRoot, "data/jobs", entry.name))
      .sort((left, right) => left.localeCompare(right));
    if (splitPaths.length !== 29) {
      throw new Error(
        "jobs.json is missing and the 29 split industry files are incomplete.",
        { cause: error },
      );
    }
    const documents = await Promise.all(
      splitPaths.map((splitPath) => readJsonFile(splitPath, "split jobs")),
    );
    return documents.flatMap((document) => {
      if (!Array.isArray(document)) {
        throw new Error("A split jobs fixture must contain an array.");
      }
      return document;
    });
  }
}

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new Error("Fixture contains duplicate " + label + ".");
  }
}

function validateSplitFixtures(
  companies: SourceCompany[],
  jobs: SourceJob[],
): void {
  assertUnique(
    companies.map(({ id }) => id),
    "company id",
  );
  assertUnique(
    companies.map(({ slug }) => slug),
    "company slug",
  );
  assertUnique(
    jobs.map(({ id }) => id),
    "job id",
  );
  assertUnique(
    jobs.map(({ slug }) => slug),
    "job slug",
  );

  const companyIds = new Set(companies.map(({ id }) => id));
  for (const job of jobs) {
    if (!companyIds.has(job.companyId)) {
      throw new Error(
        "Job " + job.id + " references unknown company " + job.companyId + ".",
      );
    }

    const normalizedSkills = job.skillTags.map(normalize);
    if (normalizedSkills.some((skill) => !skill)) {
      throw new Error("Job " + job.id + " contains an empty skill tag.");
    }
    assertUnique(normalizedSkills, "normalized skills in job " + job.id);
  }
}

async function loadSplitFixtures(): Promise<{
  companies: SourceCompany[];
  jobs: SourceJob[];
  companiesPath: string;
  jobsPath: string;
}> {
  if (process.argv.includes("--file")) {
    throw new Error(
      "The catalog fixture was removed. Use --companies and --jobs instead.",
    );
  }

  const companiesPath = argumentPath("--companies", defaultCompaniesPath);
  const jobsPath = argumentPath("--jobs", defaultJobsPath);
  const [companiesDocument, jobsDocument] = await Promise.all([
    readJsonFile(companiesPath, "companies"),
    readJobsFixture(jobsPath),
  ]);
  const companies = z
    .array(sourceCompanySchema)
    .min(1)
    .parse(companiesDocument);
  const jobs = z.array(sourceJobSchema).min(1).parse(jobsDocument);
  validateSplitFixtures(companies, jobs);

  return { companies, jobs, companiesPath, jobsPath };
}

function stableSkillId(normalizedName: string): string {
  const digest = createHash("sha256")
    .update(normalizedName, "utf8")
    .digest("hex")
    .slice(0, 24);
  return "seed-skill-" + digest;
}

function locationLabel(job: SourceJob): string {
  const city = job.location.city.trim();
  const district = job.location.district?.trim();
  if (job.location.isNationwideRemote) {
    return "Remote · " + city;
  }
  return [district, city].filter(Boolean).join(", ");
}

function mapEmploymentType(
  value: SourceJob["employmentType"],
): "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP" | "TEMPORARY" {
  const values = {
    full_time: "FULL_TIME",
    part_time: "PART_TIME",
    contract: "CONTRACT",
    internship: "INTERNSHIP",
    temporary: "TEMPORARY",
  } as const;
  return values[value];
}

function mapExperienceLevel(
  value: SourceJob["level"],
): "ENTRY" | "JUNIOR" | "MID" | "SENIOR" | "LEAD" | "MANAGER" {
  const values = {
    intern: "ENTRY",
    staff: "JUNIOR",
    senior: "SENIOR",
    team_lead: "LEAD",
    manager: "MANAGER",
    director: "MANAGER",
    executive: "MANAGER",
  } as const;
  return values[value];
}

function mapWorkArrangement(
  value: SourceJob["workArrangement"],
): "ONSITE" | "HYBRID" | "REMOTE" {
  const values = {
    onsite: "ONSITE",
    hybrid: "HYBRID",
    remote: "REMOTE",
  } as const;
  return values[value];
}

function mapSalaryPeriod(
  value: SourceJob["salary"]["period"],
): "HOUR" | "MONTH" | "YEAR" {
  const values = {
    hour: "HOUR",
    month: "MONTH",
    year: "YEAR",
  } as const;
  return values[value];
}

function mapJobStatus(job: SourceJob, now: Date): JobPostingStatus {
  if (job.status === "draft") return "DRAFT";
  if (job.status === "pending_approval") return "PENDING_REVIEW";
  if (job.status === "rejected") return "REJECTED";
  if (job.status === "closed" || job.status === "filled") return "CLOSED";
  if (job.status === "expired") return "EXPIRED";
  if (job.applyDeadline && new Date(job.applyDeadline) <= now) {
    return "EXPIRED";
  }
  return "ACTIVE";
}

function joinLines(values: string[]): string {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");
}

type ExistingJobBinding = {
  id: string;
  slug: string;
  companyId: string;
};

async function findExistingJobsForBindings(
  prisma: PrismaClient,
  jobIds: string[],
  jobSlugs: string[],
): Promise<ExistingJobBinding[]> {
  const rowsById = new Map<string, ExistingJobBinding>();
  const rowsBySlug = new Map<string, ExistingJobBinding>();
  const select = { id: true, slug: true, companyId: true } as const;

  for (let index = 0; index < jobIds.length; index += bindingQueryBatchSize) {
    const idBatch = jobIds.slice(index, index + bindingQueryBatchSize);
    const slugBatch = jobSlugs.slice(index, index + bindingQueryBatchSize);
    const [idRows, slugRows] = await Promise.all([
      prisma.jobPosting.findMany({
        where: { id: { in: idBatch } },
        select,
      }),
      prisma.jobPosting.findMany({
        where: { slug: { in: slugBatch } },
        select,
      }),
    ]);
    for (const row of idRows) rowsById.set(row.id, row);
    for (const row of slugRows) rowsBySlug.set(row.slug, row);
  }

  return [
    ...new Map(
      [...rowsById.values(), ...rowsBySlug.values()].map((row) => [
        row.id,
        row,
      ]),
    ).values(),
  ];
}

async function resolveExistingBindings(
  prisma: PrismaClient,
  companies: SourceCompany[],
  jobs: SourceJob[],
): Promise<SeedBindings> {
  const companyIds = companies.map(({ id }) => id);
  const companySlugs = companies.map(({ slug }) => slug);
  const companyTaxCodes = companies
    .map(({ taxCode }) => usableCompanyTaxCode(taxCode))
    .filter((taxCode): taxCode is string => Boolean(taxCode));
  const jobIds = jobs.map(({ id }) => id);
  const jobSlugs = jobs.map(({ slug }) => slug);
  const [existingCompanies, existingJobs] = await Promise.all([
    prisma.company.findMany({
      where: {
        OR: [
          { id: { in: companyIds } },
          { slug: { in: companySlugs } },
          ...(companyTaxCodes.length
            ? [{ normalizedTaxIdentifier: { in: companyTaxCodes } }]
            : []),
        ],
      },
      select: { id: true, slug: true, normalizedTaxIdentifier: true },
    }),
    findExistingJobsForBindings(prisma, jobIds, jobSlugs),
  ]);

  const existingCompanyById = new Map(
    existingCompanies.map((company) => [company.id, company]),
  );
  const existingCompanyBySlug = new Map(
    existingCompanies.map((company) => [company.slug, company]),
  );
  const existingCompanyByTaxCode = new Map(
    existingCompanies
      .filter(
        (
          company,
        ): company is typeof company & {
          normalizedTaxIdentifier: string;
        } => Boolean(company.normalizedTaxIdentifier),
      )
      .map((company) => [company.normalizedTaxIdentifier, company]),
  );
  const companyIdBySourceId = new Map<string, string>();
  const databaseCompanyIdToSourceId = new Map<string, string>();
  for (const sourceCompany of companies) {
    const taxCode = usableCompanyTaxCode(sourceCompany.taxCode);
    const taxMatch = taxCode
      ? existingCompanyByTaxCode.get(taxCode)
      : undefined;
    const matches = [
      existingCompanyById.get(sourceCompany.id),
      existingCompanyBySlug.get(sourceCompany.slug),
      taxMatch,
    ].filter(
      (company): company is (typeof existingCompanies)[number] =>
        company !== undefined,
    );
    const matchedIds = [...new Set(matches.map(({ id }) => id))];
    // A tax identifier is the strongest identity available here. If an old
    // seed created a duplicate row under the catalogue id, prefer the
    // verified database row carrying the tax identifier and repair jobs to
    // point at it instead of creating/using another tenant.
    if (matchedIds.length > 1 && !taxMatch) {
      throw new Error(
        "Company fixture identity is ambiguous: " + sourceCompany.slug,
      );
    }
    const databaseCompanyId = taxMatch?.id ?? matchedIds[0] ?? sourceCompany.id;
    const previousSourceId = databaseCompanyIdToSourceId.get(databaseCompanyId);
    if (previousSourceId && previousSourceId !== sourceCompany.id) {
      throw new Error(
        "Multiple company fixtures resolve to database row: " +
          databaseCompanyId,
      );
    }
    companyIdBySourceId.set(sourceCompany.id, databaseCompanyId);
    databaseCompanyIdToSourceId.set(databaseCompanyId, sourceCompany.id);
  }

  const existingJobById = new Map(existingJobs.map((job) => [job.id, job]));
  const existingJobBySlug = new Map(existingJobs.map((job) => [job.slug, job]));
  const jobIdBySourceId = new Map<string, string>();
  const databaseJobIdToSourceId = new Map<string, string>();
  for (const sourceJob of jobs) {
    const expectedCompanyId =
      companyIdBySourceId.get(sourceJob.companyId) ?? sourceJob.companyId;
    const matches = [
      existingJobById.get(sourceJob.id),
      existingJobBySlug.get(sourceJob.slug),
    ].filter((job): job is (typeof existingJobs)[number] => job !== undefined);
    const matchedIds = [...new Set(matches.map(({ id }) => id))];
    if (matchedIds.length > 1) {
      throw new Error("Job fixture identity is ambiguous: " + sourceJob.slug);
    }
    const matchedJob = matches[0];
    const matchedJobCompanyId = matchedJob
      ? (companyIdBySourceId.get(matchedJob.companyId) ?? matchedJob.companyId)
      : null;
    if (matchedJob && matchedJobCompanyId !== expectedCompanyId) {
      throw new Error(
        "Job fixture belongs to another company: " + sourceJob.slug,
      );
    }
    const databaseJobId = matchedIds[0] ?? sourceJob.id;
    const previousSourceId = databaseJobIdToSourceId.get(databaseJobId);
    if (previousSourceId && previousSourceId !== sourceJob.id) {
      throw new Error(
        "Multiple job fixtures resolve to database row: " + databaseJobId,
      );
    }
    jobIdBySourceId.set(sourceJob.id, databaseJobId);
    databaseJobIdToSourceId.set(databaseJobId, sourceJob.id);
  }

  return {
    companyIdBySourceId,
    jobIdBySourceId,
    remappedCompanyCount: [...companyIdBySourceId].filter(
      ([sourceId, databaseId]) => sourceId !== databaseId,
    ).length,
    remappedJobCount: [...jobIdBySourceId].filter(
      ([sourceId, databaseId]) => sourceId !== databaseId,
    ).length,
  };
}

async function importReferenceData(
  prisma: PrismaClient,
  companies: SourceCompany[],
  jobs: SourceJob[],
  bindings: SeedBindings,
): Promise<{
  skillByName: Map<string, { id: string; name: string }>;
  missingMembershipUserIds: string[];
}> {
  const verifiedCompanyIds = new Set(
    jobs
      .filter(({ isVerified }) => isVerified)
      .map(({ companyId }) => companyId),
  );

  return prisma.$transaction(async (transaction) => {
    const databaseCompanyIds = companies.map(
      ({ id }) => bindings.companyIdBySourceId.get(id) ?? id,
    );
    const existingCompanies = await transaction.company.findMany({
      where: { id: { in: databaseCompanyIds } },
      select: {
        id: true,
        verificationState: true,
        verifiedAt: true,
        verificationInactiveAt: true,
      },
    });
    const existingCompanyById = new Map(
      existingCompanies.map((company) => [company.id, company]),
    );
    const membershipSeeds = companies.flatMap(sourceCompanyMemberships);
    const membershipUserIds = [
      ...new Set(membershipSeeds.map(({ userId }) => userId)),
    ];
    const existingUsers = membershipUserIds.length
      ? await transaction.userAccount.findMany({
          where: { id: { in: membershipUserIds } },
          select: { id: true },
        })
      : [];
    const existingUserIds = new Set(existingUsers.map(({ id }) => id));
    const missingMembershipUserIds = membershipUserIds.filter(
      (userId) => !existingUserIds.has(userId),
    );

    for (const company of companies) {
      const databaseCompanyId =
        bindings.companyIdBySourceId.get(company.id) ?? company.id;
      const verification = sourceCompanyVerification(
        company,
        verifiedCompanyIds,
      );
      const existingCompany = existingCompanyById.get(databaseCompanyId);
      const normalizedTaxIdentifier = usableCompanyTaxCode(company.taxCode);
      const data = {
        legalName: company.name,
        displayName: company.name,
        logoUrl: company.logo,
        websiteUrl: company.website,
        publicDescription: company.description,
        publicLocation: company.address,
        size: company.size,
        industry: company.industry,
        address: company.address,
        ...(normalizedTaxIdentifier ? { normalizedTaxIdentifier } : {}),
      };
      await transaction.company.upsert({
        where: { id: databaseCompanyId },
        update: {
          ...data,
          // Keep an existing database slug stable. A legacy catalogue-id row
          // may still own the fixture slug while this row is matched by tax
          // identifier.
          // A job fixture must never revoke an existing company's verified
          // access. It may repair an old local seed that left an approved
          // company unverified, but an explicitly inactive company remains
          // inactive until an administrator changes it.
          ...(existingCompany &&
          verification.verificationState === CompanyVerificationState.ACTIVE &&
          existingCompany.verificationState !==
            CompanyVerificationState.INACTIVE &&
          !existingCompany.verificationInactiveAt
            ? {
                verificationState: CompanyVerificationState.ACTIVE,
                verifiedAt:
                  existingCompany.verifiedAt ?? verification.verifiedAt,
              }
            : {}),
        },
        create: {
          id: databaseCompanyId,
          slug: company.slug,
          ...data,
          ...verification,
        },
      });

      for (const membership of sourceCompanyMemberships(company)) {
        if (!existingUserIds.has(membership.userId)) continue;
        await transaction.companyMembership.upsert({
          where: {
            companyId_userId: {
              companyId: databaseCompanyId,
              userId: membership.userId,
            },
          },
          // Existing roles, suspensions and removals are authoritative. The
          // fixture only fills a missing membership and never overrides an
          // administrator's later decision.
          update: {},
          create: {
            companyId: databaseCompanyId,
            userId: membership.userId,
            role: membership.role,
            priorApprovedRole: membership.role,
            status: "ACTIVE",
          },
        });
      }
    }

    const skillByName = new Map<string, { id: string; name: string }>();
    for (const job of jobs) {
      for (const skillName of job.skillTags) {
        const normalizedName = normalize(skillName);
        if (skillByName.has(normalizedName)) continue;
        const saved = await transaction.skill.upsert({
          where: { normalizedName },
          update: { name: skillName },
          create: {
            id: stableSkillId(normalizedName),
            name: skillName,
            normalizedName,
          },
        });
        skillByName.set(normalizedName, {
          id: saved.id,
          name: saved.name,
        });
      }
    }

    return { skillByName, missingMembershipUserIds };
  }, importTransactionOptions);
}

async function importJob(
  transaction: Prisma.TransactionClient,
  job: SourceJob,
  companyById: ReadonlyMap<
    string,
    { source: SourceCompany; databaseId: string }
  >,
  jobIdBySourceId: ReadonlyMap<string, string>,
  skillByName: ReadonlyMap<string, { id: string; name: string }>,
  now: Date,
): Promise<void> {
  const companyBinding = companyById.get(job.companyId);
  if (!companyBinding) {
    throw new Error("Unknown company for job " + job.id + ".");
  }
  const company = companyBinding.source;
  const databaseJobId = jobIdBySourceId.get(job.id) ?? job.id;

  const desiredSkills = job.skillTags.map((skillName, position) => {
    const saved = skillByName.get(normalize(skillName));
    if (!saved) {
      throw new Error("Missing imported skill " + skillName + ".");
    }
    return {
      jobPostingId: databaseJobId,
      skillId: saved.id,
      displayName: skillName,
      required: true,
      position,
    };
  });

  const status = mapJobStatus(job, now);
  const publishedAt = new Date(job.postedAt);
  const applicationDeadline = job.applyDeadline
    ? new Date(job.applyDeadline)
    : null;
  const description = job.description;
  const responsibilities =
    joinLines(description.responsibilities) || description.overview;
  const requirements =
    joinLines(description.requirements) || description.overview;
  const searchDocumentNormalized = normalize(
    [
      job.title,
      company.name,
      company.industry,
      job.industry,
      job.subIndustry,
      job.location.city,
      job.location.district ?? "",
      ...job.skillTags,
      job.shortPitch,
      description.overview,
      ...description.responsibilities,
      ...description.requirements,
      ...description.benefits.map(({ label }) => label),
    ].join(" "),
  );
  const industryCode = job.industryCode?.trim() || job.categoryFamily?.trim();
  const subIndustryCode =
    job.subIndustryCode?.trim() || job.categoryIds?.[0]?.trim() || null;

  const data = {
    companyId: companyBinding.databaseId,
    industryId: job.industryId?.trim() || industryCode || null,
    subIndustryId: job.subIndustryId?.trim() || subIndustryCode,
    industryCode: industryCode || null,
    subIndustryCode,
    slug: job.slug,
    title: job.title,
    normalizedTitle: normalize(job.title),
    summary: job.shortPitch,
    description: description.overview,
    responsibilities,
    requirements,
    benefits: joinLines(description.benefits.map(({ label }) => label)) || null,
    education: job.education,
    numberOfHires: job.numberOfHires,
    age: job.age,
    location: locationLabel(job),
    normalizedLocation: normalize(locationLabel(job)),
    employmentType: mapEmploymentType(job.employmentType),
    experienceLevel: mapExperienceLevel(job.level),
    workArrangement: mapWorkArrangement(job.workArrangement),
    salaryMin: job.salary.min,
    salaryMax: job.salary.max,
    salaryCurrency: job.salary.currency,
    salaryPeriod: mapSalaryPeriod(job.salary.period),
    searchDocumentNormalized,
    status,
    approvedAt: status === "ACTIVE" ? publishedAt : null,
    publishedAt: status === "ACTIVE" ? publishedAt : null,
    applicationDeadline,
    closedAt:
      status === "CLOSED" || status === "EXPIRED"
        ? new Date(job.updatedAt)
        : null,
    removedAt: null,
  };

  await transaction.jobPosting.upsert({
    where: { id: databaseJobId },
    update: data,
    create: { id: databaseJobId, ...data },
  });

  await transaction.jobPostingSkill.deleteMany({
    where: { jobPostingId: databaseJobId },
  });
  if (desiredSkills.length > 0) {
    await transaction.jobPostingSkill.createMany({ data: desiredSkills });
  }

  await transaction.applicationQuestion.updateMany({
    where: { jobPostingId: databaseJobId, active: true },
    data: { active: false },
  });
}

async function importJobs(
  prisma: PrismaClient,
  companies: SourceCompany[],
  jobs: SourceJob[],
  bindings: SeedBindings,
  skillByName: ReadonlyMap<string, { id: string; name: string }>,
  now: Date,
): Promise<void> {
  const companyById = new Map(
    companies.map(
      (company) =>
        [
          company.id,
          {
            source: company,
            databaseId:
              bindings.companyIdBySourceId.get(company.id) ?? company.id,
          },
        ] as const,
    ),
  );
  const batches: Array<typeof jobs> = [];
  for (let index = 0; index < jobs.length; index += jobBatchSize) {
    batches.push(jobs.slice(index, index + jobBatchSize));
  }

  let nextBatch = 0;
  let importedJobs = 0;
  const worker = async () => {
    while (nextBatch < batches.length) {
      const batch = batches[nextBatch];
      nextBatch += 1;
      if (!batch) return;

      await prisma.$transaction(async (transaction) => {
        for (const job of batch) {
          await importJob(
            transaction,
            job,
            companyById,
            bindings.jobIdBySourceId,
            skillByName,
            now,
          );
        }
      }, importTransactionOptions);

      importedJobs += batch.length;
      if (importedJobs % 1_000 === 0 || importedJobs === jobs.length) {
        console.log(
          "Imported " + importedJobs + "/" + jobs.length + " jobs...",
        );
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(jobImportConcurrency, batches.length) },
      worker,
    ),
  );
}

async function importSplitFixtures(
  prisma: PrismaClient,
  companies: SourceCompany[],
  jobs: SourceJob[],
  now: Date,
) {
  const bindings = await resolveExistingBindings(prisma, companies, jobs);
  const { skillByName, missingMembershipUserIds } = await importReferenceData(
    prisma,
    companies,
    jobs,
    bindings,
  );
  if (missingMembershipUserIds.length) {
    console.warn(
      "Skipped fixture memberships for missing users: " +
        missingMembershipUserIds.join(", "),
    );
  }
  await importJobs(prisma, companies, jobs, bindings, skillByName, now);

  return {
    companies: companies.length,
    jobs: jobs.length,
    skills: skillByName.size,
    remappedCompanies: bindings.remappedCompanyCount,
    remappedJobs: bindings.remappedJobCount,
  };
}

async function main() {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const { companies, jobs, companiesPath, jobsPath } =
    await loadSplitFixtures();

  if (process.argv.includes("--check")) {
    console.log(
      "Validated split job data: " +
        companies.length +
        " companies and " +
        jobs.length +
        " jobs (" +
        companiesPath +
        ", " +
        jobsPath +
        ").",
    );
    return;
  }
  if (process.env.APP_ENV !== "local") {
    throw new Error(
      "Job fixture data can only be imported when APP_ENV=local.",
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Run npm run env:init first.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL),
  });
  try {
    const result = await importSplitFixtures(
      prisma,
      companies,
      jobs,
      new Date(),
    );
    console.log(
      "Imported split job data: " +
        result.companies +
        " companies, " +
        result.jobs +
        " jobs and " +
        result.skills +
        " skills" +
        (result.remappedCompanies || result.remappedJobs
          ? " (reused " +
            result.remappedCompanies +
            " existing company rows and " +
            result.remappedJobs +
            " existing job rows)."
          : "."),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
