import { z } from "zod";

export const employmentTypeSchema = z.enum([
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "INTERNSHIP",
  "TEMPORARY",
]);
export const experienceLevelSchema = z.enum([
  "ENTRY",
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
  "MANAGER",
]);
export const workArrangementSchema = z.enum(["ONSITE", "HYBRID", "REMOTE"]);
export const salaryPeriodSchema = z.enum(["HOUR", "MONTH", "YEAR"]);
export const jobSortSchema = z.enum(["RELEVANCE", "NEWEST", "SALARY_DESC"]);
export const jobSearchBySchema = z.enum(["TITLE", "COMPANY", "BOTH"]);

const omitEmptyControlValue = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const stringArray = <T extends z.ZodType>(item: T, maximum: number) =>
  z.preprocess(
    (value) =>
      Array.isArray(value)
        ? value.filter((item) => item !== "" && item !== null)
        : value,
    z
      .array(item)
      .max(maximum)
      .refine((values) => new Set(values).size === values.length, {
        message: "Use each value only once.",
      }),
  );

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    omitEmptyControlValue,
    z.coerce.number().pipe(schema).optional(),
  );

export const jobSearchQuerySchema = z
  .object({
    q: z.string().trim().max(200).default(""),
    searchBy: jobSearchBySchema.default("BOTH"),
    location: z.string().trim().max(160).default(""),
    employmentType: stringArray(employmentTypeSchema, 5).default([]),
    experienceLevel: stringArray(experienceLevelSchema, 6).default([]),
    workArrangement: stringArray(workArrangementSchema, 3).default([]),
    skills: stringArray(z.string().trim().min(1).max(80), 20).default([]),
    salaryMin: optionalNumber(z.number().finite().min(0)),
    salaryMax: optionalNumber(z.number().finite().min(0)),
    salaryCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/u)
      .default("VND"),
    salaryPeriod: salaryPeriodSchema.default("MONTH"),
    postedWithinDays: z.preprocess(
      omitEmptyControlValue,
      z.coerce
        .number()
        .int()
        .refine((value) => [1, 3, 7, 14, 30].includes(value))
        .optional(),
    ),
    sort: jobSortSchema.default("RELEVANCE"),
    cursor: z.preprocess(
      omitEmptyControlValue,
      z.string().max(1024).optional(),
    ),
    limit: z.preprocess(
      omitEmptyControlValue,
      z.coerce.number().int().min(1).max(50).default(20),
    ),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.salaryMin !== undefined &&
      value.salaryMax !== undefined &&
      value.salaryMin > value.salaryMax
    ) {
      context.addIssue({
        code: "custom",
        path: ["salaryMax"],
        message: "Maximum salary must not be below minimum salary.",
      });
    }
  });

export const publicCompanySchema = z
  .object({
    slug: z.string().min(1).max(200),
    displayName: z.string().min(1).max(160),
    logoUrl: z.string().url().nullable(),
    websiteUrl: z.string().url().nullable(),
    publicDescription: z.string().max(3000).nullable(),
    publicLocation: z.string().max(160).nullable(),
    size: z.string().max(80).optional(),
    industry: z.string().max(160).optional(),
    address: z.string().max(300).optional(),
  })
  .strict();

export const publicJobActionsSchema = z
  .object({
    authenticated: z.boolean(),
    saved: z.boolean(),
    applied: z.boolean(),
    canSave: z.boolean(),
    canReport: z.boolean(),
    canApply: z.boolean(),
  })
  .strict();

export const salarySchema = z
  .object({
    minimum: z.number().nonnegative(),
    maximum: z.number().nonnegative(),
    currency: z.string().regex(/^[A-Z]{3}$/u),
    period: salaryPeriodSchema,
  })
  .strict()
  .refine((value) => value.minimum <= value.maximum)
  .nullable();

export const jobCardSchema = z
  .object({
    id: z.string().min(1).max(128),
    slug: z.string().min(1).max(220),
    title: z.string().min(1).max(200),
    company: publicCompanySchema,
    location: z.string().min(1).max(160),
    employmentType: employmentTypeSchema,
    experienceLevel: experienceLevelSchema,
    workArrangement: workArrangementSchema,
    salary: salarySchema,
    summary: z.string().min(1).max(500),
    education: z.string().max(200).optional(),
    numberOfHires: z.number().int().positive().optional(),
    age: z.string().max(80).optional(),
    skills: z.array(z.string().min(1).max(80)).max(50),
    requirementHighlights: z
      .array(z.string().min(1).max(2000))
      .max(20)
      .optional(),
    benefitHighlights: z.array(z.string().min(1).max(2000)).max(20).optional(),
    benefitItems: z
      .array(
        z
          .object({
            icon: z.string().min(1).max(80),
            label: z.string().min(1).max(300),
          })
          .strict(),
      )
      .max(50)
      .optional(),
    publishedAt: z.string().datetime(),
    updatedAt: z.string().datetime().optional(),
    applicationDeadline: z.string().datetime().nullable(),
    isUrgent: z.boolean().optional(),
    workOnSaturday: z.boolean().optional(),
    isVerified: z.boolean().optional(),
    categoryIds: z.array(z.string().min(1).max(128)).max(20).optional(),
    categoryFamily: z.string().max(80).optional(),
    experienceMinYears: z.number().int().nonnegative().optional(),
    matchScore: z.number().int().min(0).max(100).optional(),
    actions: publicJobActionsSchema,
  })
  .strict();

export const jobSearchResponseSchema = z
  .object({
    items: z.array(jobCardSchema).max(50),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
    criteria: z.record(z.string(), z.unknown()),
  })
  .strict();

export const jobDetailSchema = jobCardSchema
  .extend({
    state: z.enum(["ACTIVE", "CLOSED", "EXPIRED"]),
    description: z.string().min(1).max(20_000),
    responsibilities: z.string().min(1).max(12_000),
    requirements: z.string().min(1).max(12_000),
    benefits: z.string().max(8_000).nullable(),
    canonicalUrl: z.string().url(),

    workOnSaturday: z.boolean().optional(),
    relatedJobs: z.array(jobCardSchema).max(6).optional(),
    recommendedJobs: z.array(jobCardSchema).max(3).optional(),
  })
  .strict();

export type JobSearchQuery = z.infer<typeof jobSearchQuerySchema>;
export type JobCard = z.infer<typeof jobCardSchema>;
export type JobSearchResponse = z.infer<typeof jobSearchResponseSchema>;
export type JobDetail = z.infer<typeof jobDetailSchema>;
