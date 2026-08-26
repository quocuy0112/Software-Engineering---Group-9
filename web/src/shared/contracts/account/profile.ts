import { z } from "zod";

const ownedIdSchema = z.string().min(1).max(128);
const nullableText = (maximum: number) => z.string().max(maximum).nullable();
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Use an ISO calendar date.");

export const profileVisibilitySectionSchema = z.enum([
  "avatar",
  "headline",
  "summary",
  "location",
  "skills",
  "experience",
  "education",
  "links",
]);

export const profileVisibilitySchema = z
  .object({
    discoverableByExactId: z.boolean(),
    candidateSections: z.array(profileVisibilitySectionSchema).max(8),
    recruiterSections: z.array(profileVisibilitySectionSchema).max(8),
    version: z.number().int().nonnegative(),
  })
  .strict();

export const profileBasicsSchema = z
  .object({
    headline: nullableText(200),
    summary: nullableText(5_000),
    phone: nullableText(32),
    location: nullableText(160),
  })
  .strict();

/**
 * Personal context that belongs to the candidate account only.  It is kept
 * separate from professional profile signals so it cannot accidentally flow
 * into public profile or Smart Match projections.
 */
export const profileAboutSchema = z
  .object({
    dateOfBirth: isoDateSchema.nullable(),
    preferredName: nullableText(120),
    interests: nullableText(500),
    bio: nullableText(1_000),
  })
  .strict();

export const profileSkillSchema = z
  .object({
    id: ownedIdSchema,
    label: z.string().min(1).max(80),
  })
  .strict();

export const profileExperienceSchema = z
  .object({
    id: ownedIdSchema,
    title: z.string().min(1).max(200),
    company: z.string().min(1).max(200),
    description: nullableText(3_000),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable(),
    current: z.boolean(),
  })
  .strict();

export const profileEducationSchema = z
  .object({
    id: ownedIdSchema,
    institution: z.string().min(1).max(200),
    degree: z.string().min(1).max(200),
    field: nullableText(200),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable(),
    current: z.boolean(),
  })
  .strict();

export const profileSocialLinkSchema = z
  .object({
    id: ownedIdSchema,
    url: z.string().min(1).max(2_048),
  })
  .strict();

export const candidateProfileSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    empty: z.boolean(),
    basics: profileBasicsSchema,
    // Optional for backwards-compatible consumers and fixtures. Aggregate
    // responses include the object; clients should treat a missing value as
    // an empty private section.
    about: profileAboutSchema.optional(),
    skills: z.array(profileSkillSchema).max(50),
    experience: z.array(profileExperienceSchema).max(50),
    education: z.array(profileEducationSchema).max(50),
    socialLinks: z.array(profileSocialLinkSchema).max(10),
    visibility: profileVisibilitySchema.optional(),
  })
  .strict();

const baseRevisionSchema = z.number().int().nonnegative();
const skillMutationSchema = z
  .object({
    id: ownedIdSchema.optional(),
    label: z.string().min(1).max(80),
  })
  .strict();
const experienceMutationSchema = profileExperienceSchema
  .omit({ id: true })
  .extend({ id: ownedIdSchema.optional() })
  .strict();
const educationMutationSchema = profileEducationSchema
  .omit({ id: true })
  .extend({ id: ownedIdSchema.optional() })
  .strict();
const socialLinkMutationSchema = profileSocialLinkSchema
  .omit({ id: true })
  .extend({ id: ownedIdSchema.optional() })
  .strict();

export const profileSectionMutationSchema = z.discriminatedUnion("section", [
  z
    .object({
      section: z.literal("visibility"),
      baseRevision: baseRevisionSchema,
      visibility: profileVisibilitySchema.omit({ version: true }),
    })
    .strict(),
  z
    .object({
      section: z.literal("basics"),
      baseRevision: baseRevisionSchema,
      basics: profileBasicsSchema,
    })
    .strict(),
  z
    .object({
      section: z.literal("about"),
      baseRevision: baseRevisionSchema,
      about: profileAboutSchema,
    })
    .strict(),
  z
    .object({
      section: z.literal("skills"),
      baseRevision: baseRevisionSchema,
      skills: z.array(skillMutationSchema).max(50),
    })
    .strict(),
  z
    .object({
      section: z.literal("experience"),
      baseRevision: baseRevisionSchema,
      experience: z.array(experienceMutationSchema).max(50),
    })
    .strict(),
  z
    .object({
      section: z.literal("education"),
      baseRevision: baseRevisionSchema,
      education: z.array(educationMutationSchema).max(50),
    })
    .strict(),
  z
    .object({
      section: z.literal("socialLinks"),
      baseRevision: baseRevisionSchema,
      socialLinks: z.array(socialLinkMutationSchema).max(10),
    })
    .strict(),
]);

export const normalizationWarningSchema = z
  .object({
    field: z.string().min(1).max(160),
    message: z.string().min(1).max(240),
  })
  .strict();

export const profileMutationOutcomeSchema = z
  .object({
    profile: candidateProfileSchema,
    conflictApplied: z.boolean(),
    warnings: z.array(normalizationWarningSchema).max(100),
    message: z.string().min(1).max(240),
  })
  .strict();

export const skillSuggestionsQuerySchema = z
  .object({
    query: z.string().trim().min(1).max(80),
    limit: z.preprocess(
      (value) => (value === undefined ? 10 : value),
      z.coerce.number().int().min(1).max(20),
    ),
  })
  .strict();

export const skillSuggestionsResponseSchema = z
  .object({
    skills: z.array(profileSkillSchema).max(20),
  })
  .strict();

export type CandidateProfileContract = z.infer<typeof candidateProfileSchema>;
export type ProfileSectionMutation = z.infer<
  typeof profileSectionMutationSchema
>;
export type ProfileMutationOutcome = z.infer<
  typeof profileMutationOutcomeSchema
>;
export type NormalizationWarning = z.infer<typeof normalizationWarningSchema>;
export type ProfileExperienceMutation = z.infer<
  typeof experienceMutationSchema
>;
export type ProfileEducationMutation = z.infer<typeof educationMutationSchema>;
