import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnvironment } from "dotenv";
import { z } from "zod";
import { Prisma, PrismaClient } from "../src/backend/generated/prisma/client";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultCatalogPath = resolve(webRoot, "data/jobs/catalog.v1.json");
const jobBatchSize = 50;
const jobImportConcurrency = 4;
const importTransactionOptions = {
  maxWait: 30_000,
  timeout: 60_000,
} as const;
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

const companySchema = z
  .object({
    id: z.string().min(1).max(128),
    slug: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    legalName: z.string().min(1).max(200),
    displayName: z.string().min(1).max(160),
    websiteUrl: z.string().url().nullable(),
    publicDescription: z.string().max(3_000).nullable(),
    publicLocation: z.string().max(160).nullable(),
    verifiedAt: z.string().datetime(),
  })
  .strict();

const jobSchema = z
  .object({
    id: z.string().min(1).max(128),
    companyId: z.string().min(1).max(128),
    sourceUrl: z.string().url(),
    slug: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    title: z.string().min(1).max(200),
    summary: z.string().min(1).max(500),
    description: z.string().min(1).max(20_000),
    responsibilities: z.string().min(1).max(12_000),
    requirements: z.string().min(1).max(12_000),
    benefits: z.string().max(8_000).nullable(),
    location: z.string().min(1).max(160),
    employmentType: z.enum([
      "FULL_TIME",
      "PART_TIME",
      "CONTRACT",
      "INTERNSHIP",
      "TEMPORARY",
    ]),
    experienceLevel: z.enum([
      "ENTRY",
      "JUNIOR",
      "MID",
      "SENIOR",
      "LEAD",
      "MANAGER",
    ]),
    workArrangement: z.enum(["ONSITE", "HYBRID", "REMOTE"]),
    salary: z
      .object({
        min: z.number().int().nonnegative(),
        max: z.number().int().nonnegative(),
        currency: z.string().regex(/^[A-Z]{3}$/u),
        period: z.enum(["HOUR", "MONTH", "YEAR"]),
      })
      .strict()
      .refine(({ min, max }) => min <= max, {
        message: "salary.min must be less than or equal to salary.max",
      })
      .nullable(),
    skills: z
      .array(
        z
          .object({
            name: z.string().min(1).max(80),
            required: z.boolean(),
          })
          .strict(),
      )
      .max(50),
    questions: z
      .array(
        z
          .object({
            id: z.string().min(1).max(128),
            prompt: z.string().min(1).max(500),
            description: z.string().max(1_000).nullable(),
            required: z.boolean(),
          })
          .strict(),
      )
      .max(20),
    publishedAt: z.string().datetime(),
    applicationDeadline: z.string().datetime().nullable(),
  })
  .strict();

const catalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    datasetVersion: z.string().min(1).max(64),
    source: z.string().min(1).max(64),
    companies: z.array(companySchema).min(1),
    jobs: z.array(jobSchema).min(1),
  })
  .strict()
  .superRefine((catalog, context) => {
    const companyIds = new Set(catalog.companies.map(({ id }) => id));
    const uniqueFields = [
      ["company id", catalog.companies.map(({ id }) => id)],
      ["company slug", catalog.companies.map(({ slug }) => slug)],
      ["job id", catalog.jobs.map(({ id }) => id)],
      ["job slug", catalog.jobs.map(({ slug }) => slug)],
      [
        "question id",
        catalog.jobs.flatMap(({ questions }) => questions.map(({ id }) => id)),
      ],
    ] as const;

    for (const [label, values] of uniqueFields) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          message: `Catalog contains a duplicate ${label}.`,
        });
      }
    }

    for (const job of catalog.jobs) {
      if (!companyIds.has(job.companyId)) {
        context.addIssue({
          code: "custom",
          message: `Job ${job.id} references unknown company ${job.companyId}.`,
        });
      }
      const normalizedSkills = job.skills.map(({ name }) => normalize(name));
      if (new Set(normalizedSkills).size !== normalizedSkills.length) {
        context.addIssue({
          code: "custom",
          message: `Job ${job.id} contains duplicate normalized skills.`,
        });
      }
    }
  });

type Catalog = z.infer<typeof catalogSchema>;

function catalogPathFromArguments(): string {
  const fileArgument = process.argv.indexOf("--file");
  if (fileArgument < 0) return defaultCatalogPath;
  const value = process.argv[fileArgument + 1];
  if (!value) throw new Error("--file requires a path.");
  return resolve(process.cwd(), value);
}

async function loadCatalog(): Promise<{ catalog: Catalog; path: string }> {
  const path = catalogPathFromArguments();
  const document: unknown = JSON.parse(await readFile(path, "utf8"));
  return { catalog: catalogSchema.parse(document), path };
}

function stableSkillId(normalizedName: string): string {
  const digest = createHash("sha256")
    .update(normalizedName, "utf8")
    .digest("hex")
    .slice(0, 24);
  return `catalog-skill-${digest}`;
}

async function validateExistingBindings(
  prisma: PrismaClient,
  catalog: Catalog,
): Promise<void> {
  const expectedCompanyIdBySlug = new Map(
    catalog.companies.map(({ id, slug }) => [slug, id] as const),
  );
  const expectedJobIdBySlug = new Map(
    catalog.jobs.map(({ id, slug }) => [slug, id] as const),
  );
  const expectedJobIdByQuestionId = new Map(
    catalog.jobs.flatMap((job) =>
      job.questions.map(({ id }) => [id, job.id] as const),
    ),
  );
  const [companies, jobs, questions] = await Promise.all([
    prisma.company.findMany({
      where: { slug: { in: [...expectedCompanyIdBySlug.keys()] } },
      select: { id: true, slug: true },
    }),
    prisma.jobPosting.findMany({
      where: { slug: { in: [...expectedJobIdBySlug.keys()] } },
      select: { id: true, slug: true },
    }),
    prisma.applicationQuestion.findMany({
      where: { id: { in: [...expectedJobIdByQuestionId.keys()] } },
      select: { id: true, jobPostingId: true },
    }),
  ]);

  for (const company of companies) {
    if (expectedCompanyIdBySlug.get(company.slug) !== company.id) {
      throw new Error(
        `Company slug already belongs to another row: ${company.slug}`,
      );
    }
  }
  for (const job of jobs) {
    if (expectedJobIdBySlug.get(job.slug) !== job.id) {
      throw new Error(`Job slug already belongs to another row: ${job.slug}`);
    }
  }
  for (const question of questions) {
    if (expectedJobIdByQuestionId.get(question.id) !== question.jobPostingId) {
      throw new Error(`Question ${question.id} belongs to another job.`);
    }
  }
}

async function importReferenceData(
  prisma: PrismaClient,
  catalog: Catalog,
): Promise<Map<string, { id: string; name: string }>> {
  return prisma.$transaction(async (transaction) => {
    for (const company of catalog.companies) {
      const data = {
        slug: company.slug,
        legalName: company.legalName,
        displayName: company.displayName,
        logoUrl: null,
        websiteUrl: company.websiteUrl,
        publicDescription: company.publicDescription,
        publicLocation: company.publicLocation,
        verifiedAt: new Date(company.verifiedAt),
      };
      await transaction.company.upsert({
        where: { id: company.id },
        update: data,
        create: { id: company.id, ...data },
      });
    }

    const skillByName = new Map<string, { id: string; name: string }>();
    for (const job of catalog.jobs) {
      for (const skill of job.skills) {
        const normalizedName = normalize(skill.name);
        if (skillByName.has(normalizedName)) continue;
        const saved = await transaction.skill.upsert({
          where: { normalizedName },
          update: { name: skill.name },
          create: {
            id: stableSkillId(normalizedName),
            name: skill.name,
            normalizedName,
          },
        });
        skillByName.set(normalizedName, { id: saved.id, name: saved.name });
      }
    }

    return skillByName;
  }, importTransactionOptions);
}

async function importJob(
  transaction: Prisma.TransactionClient,
  job: Catalog["jobs"][number],
  companyById: ReadonlyMap<string, Catalog["companies"][number]>,
  skillByName: ReadonlyMap<string, { id: string; name: string }>,
): Promise<void> {
  const company = companyById.get(job.companyId);
  if (!company) throw new Error(`Unknown company for job ${job.id}.`);

  const desiredSkills = job.skills.map((skill, position) => {
    const saved = skillByName.get(normalize(skill.name));
    if (!saved) throw new Error(`Missing imported skill ${skill.name}.`);
    return {
      jobPostingId: job.id,
      skillId: saved.id,
      displayName: skill.name,
      required: skill.required,
      position,
    };
  });
  const searchDocumentNormalized = normalize(
    [
      job.title,
      company.displayName,
      job.location,
      ...job.skills.map(({ name }) => name),
      job.summary,
      job.description,
      job.responsibilities,
      job.requirements,
    ].join(" "),
  );
  const data = {
    companyId: job.companyId,
    slug: job.slug,
    title: job.title,
    normalizedTitle: normalize(job.title),
    summary: job.summary,
    description: job.description,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    benefits: job.benefits,
    location: job.location,
    normalizedLocation: normalize(job.location),
    employmentType: job.employmentType,
    experienceLevel: job.experienceLevel,
    workArrangement: job.workArrangement,
    salaryMin: job.salary?.min ?? null,
    salaryMax: job.salary?.max ?? null,
    salaryCurrency: job.salary?.currency ?? null,
    salaryPeriod: job.salary?.period ?? null,
    searchDocumentNormalized,
    status: "ACTIVE" as const,
    approvedAt: new Date(job.publishedAt),
    publishedAt: new Date(job.publishedAt),
    applicationDeadline: job.applicationDeadline
      ? new Date(job.applicationDeadline)
      : null,
    closedAt: null,
    removedAt: null,
  };
  await transaction.jobPosting.upsert({
    where: { id: job.id },
    update: data,
    create: { id: job.id, ...data },
  });

  await transaction.jobPostingSkill.deleteMany({
    where: { jobPostingId: job.id },
  });
  if (desiredSkills.length > 0) {
    await transaction.jobPostingSkill.createMany({ data: desiredSkills });
  }

  const desiredQuestionIds = job.questions.map(({ id }) => id);
  await transaction.applicationQuestion.updateMany({
    where: {
      jobPostingId: job.id,
      ...(desiredQuestionIds.length > 0
        ? { id: { notIn: desiredQuestionIds } }
        : {}),
      active: true,
    },
    data: { active: false },
  });
  for (const [position, question] of job.questions.entries()) {
    const questionData = {
      prompt: question.prompt,
      description: question.description,
      kind: "TEXT" as const,
      required: question.required,
      position,
      active: true,
    };
    await transaction.applicationQuestion.upsert({
      where: { id: question.id },
      update: questionData,
      create: {
        id: question.id,
        jobPostingId: job.id,
        ...questionData,
      },
    });
  }
}

async function importJobs(
  prisma: PrismaClient,
  catalog: Catalog,
  skillByName: ReadonlyMap<string, { id: string; name: string }>,
): Promise<void> {
  const companyById = new Map(
    catalog.companies.map((company) => [company.id, company] as const),
  );
  const batches: Array<typeof catalog.jobs> = [];
  for (let index = 0; index < catalog.jobs.length; index += jobBatchSize) {
    batches.push(catalog.jobs.slice(index, index + jobBatchSize));
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
          await importJob(transaction, job, companyById, skillByName);
        }
      }, importTransactionOptions);

      importedJobs += batch.length;
      if (importedJobs % 1_000 === 0 || importedJobs === catalog.jobs.length) {
        console.log(`Imported ${importedJobs}/${catalog.jobs.length} jobs...`);
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

async function importCatalog(prisma: PrismaClient, catalog: Catalog) {
  await validateExistingBindings(prisma, catalog);
  const skillByName = await importReferenceData(prisma, catalog);
  await importJobs(prisma, catalog, skillByName);

  return {
    companies: catalog.companies.length,
    jobs: catalog.jobs.length,
    skills: skillByName.size,
  };
}

async function main() {
  const { catalog, path } = await loadCatalog();
  if (process.argv.includes("--check")) {
    console.log(
      `Validated job catalog ${catalog.datasetVersion}: ${catalog.companies.length} companies and ${catalog.jobs.length} jobs (${path}).`,
    );
    return;
  }
  if (process.env.APP_ENV !== "local") {
    throw new Error(
      "Job catalog data can only be imported when APP_ENV=local.",
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Run npm run env:init first.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL),
  });
  try {
    const result = await importCatalog(prisma, catalog);
    console.log(
      `Imported job catalog ${catalog.datasetVersion}: ${result.companies} companies, ${result.jobs} jobs and ${result.skills} skills.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
