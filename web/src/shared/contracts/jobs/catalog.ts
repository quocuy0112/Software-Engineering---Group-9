import { z } from "zod";
import {
  defaultJobPreferences,
  jobPreferencesSchema,
  jobPreferencesUpdateSchema,
  type JobPreferences,
} from "./preferences";

const nullableString = (maximum: number) =>
  z.string().trim().max(maximum).nullable();
export const companyLogoSchema = z
  .union([
    z.string().url().max(2_000),
    z
      .string()
      .min(32)
      .max(1_100_000)
      .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/u),
  ])
  .nullable();

export const recruiterCompanySettingsInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    logo: companyLogoSchema,
    size: z.string().trim().min(1).max(80),
    industry: z.string().trim().min(1).max(160),
    address: z.string().trim().min(1).max(300),
    website: z.string().url().max(2_000).nullable(),
    description: z.string().trim().max(3_000).nullable(),
  })
  .strict();

export const jobPostingStatusSchema = z.enum([
  "draft",
  "pending_approval",
  "rejected",
  "active",
  "closed",
]);

export const jobCatalogSchema = z
  .object({
    id: z.string().min(1).max(128),
    slug: z.string().min(1).max(220),
    companyId: z.string().min(1).max(128),
    // Null/omitted for the immutable shared catalogue. User-created jobs
    // carry the account id so a user reset can remove only owned records.
    createdByUserId: z.string().min(1).max(128).nullable().optional(),
    industry: z.string().min(1).max(160),
    industryCode: z.string().max(80),
    subIndustry: z.string().min(1).max(160),
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
    age: z.string().max(80),
    numberOfHires: z.number().int().positive(),
    status: jobPostingStatusSchema,
    approvalComment: nullableString(2_000).optional(),
    isUrgent: z.boolean(),
    isVerified: z.boolean(),
    postedAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    applyDeadline: z.string().datetime().nullable(),
    description: z
      .object({
        overview: z.string().min(1).max(20_000),
        topReasonsToJoin: z.array(z.string().min(1).max(2_000)).max(100),
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

/**
 * Drafts retain the complete catalogue shape so they can move through the
 * existing repositories, but authoring fields may be empty until submission.
 * Primitive bounds remain enforced while completeness and cross-field checks
 * are deferred to submission.
 */
export const jobDraftCatalogSchema = jobCatalogSchema.extend({
  title: z.string().max(200),
  shortPitch: z.string().max(500),
  subIndustry: z.string().max(160),
  salary: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
      currency: z.string().regex(/^[A-Z]{3}$/u),
      period: z.enum(["hour", "month", "year"]),
      isNegotiable: z.boolean(),
    })
    .strict(),
  location: jobCatalogSchema.shape.location.extend({
    city: z.string().max(160),
  }),
  description: jobCatalogSchema.shape.description.extend({
    overview: z.string().max(20_000),
  }),
  experience: jobCatalogSchema.shape.experience.extend({
    label: z.string().max(80),
  }),
  level: z.string().max(80),
  employmentType: z.string().max(80),
  workArrangement: z.string().max(80),
  education: z.string().max(200),
  numberOfHires: z.number().int().nonnegative(),
});

export const companyCatalogSchema = z
  .object({
    id: z.string().min(1).max(128),
    slug: z.string().min(1).max(200),
    name: z.string().min(1).max(160),
    entityType: z.string().trim().max(120).nullable().optional(),
    logo: companyLogoSchema,
    size: z.string().min(1).max(80),
    industry: z.string().min(1).max(160),
    address: z.string().min(1).max(300),
    website: z.string().url().nullable(),
    description: z.string().max(3_000).nullable(),
    rating: z
      .object({
        score: z.number().nonnegative(),
        reviewCount: z.number().int().nonnegative(),
      })
      .optional(),
    jobCount: z.number().int().nonnegative().optional(),
    ownerUserId: z.string().min(1).max(128).nullable().optional(),
    memberUserIds: z.array(z.string().min(1).max(128)).max(10_000).default([]),
    taxCode: z.string().regex(/^\d{10}$/u),
    verificationStatus: z.enum(["pending", "approved", "rejected"]),
  })
  .strict();

export const userJobStateSchema = z
  .object({
    userId: z.string().min(1).max(128),
    savedJobIds: z.array(z.string().min(1).max(128)).max(10_000),
    hiddenJobIds: z.array(z.string().min(1).max(128)).max(10_000),
    appliedJobIds: z.array(z.string().min(1).max(128)).max(10_000),
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
export type JobPostingStatus = z.infer<typeof jobPostingStatusSchema>;
export type UserJobState = z.infer<typeof userJobStateSchema>;
export type RecruiterCompanySettings = {
  id: string;
  slug: string;
  name: string;
  entityType: string | null;
  logo: string | null;
  size: string;
  industry: string;
  address: string;
  website: string | null;
  description: string | null;
  ownerUserId: string | null;
  memberUserIds: string[];
  taxCode: string;
  verificationStatus: "pending" | "approved" | "rejected";
  profileComplete: boolean;
  missingProfileFields: Array<
    "name" | "industry" | "size" | "address" | "logo"
  >;
};

export type RecruiterCompanySettingsInput = z.infer<
  typeof recruiterCompanySettingsInputSchema
>;
export type { JobPreferences };
export { jobPreferencesSchema, jobPreferencesUpdateSchema };
