import { z } from "zod";
import {
  defaultJobPreferences,
  jobApplicationStatusSchema,
  jobPreferencesSchema,
  jobPreferencesUpdateSchema,
  type JobPreferences,
} from "./preferences";

const nullableString = (maximum: number) =>
  z.string().trim().max(maximum).nullable();

export const jobCatalogSchema = z
  .object({
    id: z.string().min(1).max(128),
    slug: z.string().min(1).max(220),
    companyId: z.string().min(1).max(128),
    title: z.string().min(1).max(200),
    shortPitch: z.string().min(1).max(500),
    categoryIds: z.array(z.string().min(1).max(128)).max(20),
    categoryFamily: z.string().min(1).max(80),
    skillTags: z.array(z.string().min(1).max(80)).max(50),
    location: z
      .object({
        city: z.string().min(1).max(160),
        district: nullableString(160),
        isNationwideRemote: z.boolean(),
      })
      .strict(),
    salary: z
      .object({
        min: z.number().nonnegative(),
        max: z.number().nonnegative(),
        currency: z.string().regex(/^[A-Z]{3}$/u),
        period: z.enum(["hour", "month", "year"]),
        isNegotiable: z.boolean(),
      })
      .strict()
      .refine((value) => value.min <= value.max),
    experience: z
      .object({
        minYears: z.number().int().nonnegative(),
        label: z.string().min(1).max(80),
      })
      .strict(),
    level: z.string().min(1).max(80),
    employmentType: z.string().min(1).max(80),
    workArrangement: z.string().min(1).max(80),
    workOnSaturday: z.boolean(),
    education: z.string().min(1).max(200),
    numberOfHires: z.number().int().positive(),
    status: z.enum(["open", "closed", "expired"]),
    isUrgent: z.boolean(),
    isVerified: z.boolean(),
    postedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    applyDeadline: z.string().datetime().nullable(),
    description: z
      .object({
        overview: z.string().min(1).max(20_000),
        responsibilities: z.array(z.string().min(1).max(2_000)).max(100),
        requirements: z.array(z.string().min(1).max(2_000)).max(100),
        benefits: z
          .array(
            z
              .object({
                icon: z.string().min(1).max(80),
                label: z.string().min(1).max(300),
              })
              .strict(),
          )
          .max(50),
        generalInfo: z
          .object({
            reportsTo: nullableString(160),
            department: nullableString(160),
            workingHours: nullableString(300),
            workAddress: nullableString(300),
          })
          .strict(),
      })
      .strict(),
    stats: z
      .object({
        viewCount: z.number().int().nonnegative(),
        applicantCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const companyCatalogSchema = z
  .object({
    id: z.string().min(1).max(128),
    slug: z.string().min(1).max(200),
    name: z.string().min(1).max(160),
    logo: z.string().url().nullable(),
    size: z.string().min(1).max(80),
    industry: z.string().min(1).max(160),
    address: z.string().min(1).max(300),
    website: z.string().url().nullable(),
    description: z.string().max(3_000).nullable(),
  })
  .strict();

export const appliedJobStateSchema = z
  .object({
    jobId: z.string().min(1).max(128),
    appliedAt: z.string().datetime(),
    status: jobApplicationStatusSchema.default("submitted"),
    cvFileRef: z.string().min(1).max(256).nullable().optional(),
    contactSnapshot: z
      .object({
        fullName: z.string().trim().min(1).max(150),
        email: z.string().trim().email().max(254),
        phone: z.string().trim().min(9).max(20),
      })
      .strict(),
    aiAnalysisConsent: z.boolean(),
    aiMatchScore: z.number().int().min(0).max(100).nullable().optional(),
  })
  .strict();

export const userJobStateSchema = z
  .object({
    userId: z.string().min(1).max(128),
    savedJobIds: z.array(z.string().min(1).max(128)).max(10_000),
    hiddenJobIds: z.array(z.string().min(1).max(128)).max(10_000),
    appliedJobs: z.array(appliedJobStateSchema).max(10_000),
    jobPreferences: jobPreferencesSchema.default(defaultJobPreferences),
    savedFilterPresets: z
      .array(
        z
          .object({
            id: z.string().min(1).max(128),
            name: z.string().min(1).max(160),
            filters: z.record(z.string(), z.unknown()),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();

export const userJobStateViewSchema = z
  .object({
    savedJobIds: z.array(z.string().min(1).max(128)).max(10_000),
    hiddenJobIds: z.array(z.string().min(1).max(128)).max(10_000),
    appliedJobIds: z.array(z.string().min(1).max(128)).max(10_000),
  })
  .strict();
export type JobCatalogItem = z.infer<typeof jobCatalogSchema>;
export type CompanyCatalogItem = z.infer<typeof companyCatalogSchema>;
export type UserJobState = z.infer<typeof userJobStateSchema>;
export type AppliedJobState = z.infer<typeof appliedJobStateSchema>;
export type { JobPreferences };
export { jobPreferencesSchema, jobPreferencesUpdateSchema };
