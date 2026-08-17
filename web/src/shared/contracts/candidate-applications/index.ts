import { z } from "zod";
import { applicationStageSchema, type ApplicationStage } from "@/shared/contracts/jobs/applications";

const idSchema = z.string().trim().min(1).max(128);
const isoDateTime = z.string().datetime();

export const applicationFileMimeTypeSchema = z.enum([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const applicationFileParseStatusSchema = z.enum([
  "READY",
  "PARTIAL",
  "FAILED",
  "NOT_APPLICABLE",
]);

/**
 * Candidate-facing metadata for one immutable, validated application file.
 * Internal storage locators and checksums intentionally never cross this
 * contract boundary.
 */
export const applicationFileDescriptorSchema = z
  .object({
    versionId: idSchema,
    displayName: z.string().trim().min(1).max(200),
    fileName: z.string().trim().min(1).max(255).optional(),
    mimeType: applicationFileMimeTypeSchema,
    byteSize: z.number().int().min(1).max(5_000_000),
    version: z.number().int().positive().optional(),
    parseStatus: applicationFileParseStatusSchema,
    confirmedAt: isoDateTime.optional(),
  })
  .strict();

export type ApplicationFileDescriptor = z.infer<
  typeof applicationFileDescriptorSchema
>;

export const candidatePersonalInfoSchema = z
  .object({
    fullName: z.string().trim().min(1).max(150),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(20),
  })
  .strict();

export type CandidatePersonalInfo = z.infer<typeof candidatePersonalInfoSchema>;

export const coverLetterTextDraftSchema = z
  .object({
    kind: z.literal("TEXT"),
    text: z.string().trim().min(1).max(10_000),
  })
  .strict();

export const coverLetterFileDraftSchema = z
  .object({
    kind: z.literal("FILE"),
    file: applicationFileDescriptorSchema,
  })
  .strict();

/** One optional field with mutually exclusive text/file variants. */
export const coverLetterDraftSchema = z.discriminatedUnion("kind", [
  coverLetterTextDraftSchema,
  coverLetterFileDraftSchema,
]);

export type CoverLetterDraft = z.infer<typeof coverLetterDraftSchema>;

export const applicationDraftSchema = z
  .object({
    draftId: idSchema,
    jobId: idSchema,
    revision: z.number().int().positive(),
    personalInformation: candidatePersonalInfoSchema,
    cv: applicationFileDescriptorSchema.nullable(),
    coverLetter: coverLetterDraftSchema.nullable(),
    message: z.string().max(2_000).nullable(),
    confirmationAccepted: z.boolean(),
    updatedAt: isoDateTime,
    expiresAt: isoDateTime,
  })
  .strict();

export type ApplicationDraft = z.infer<typeof applicationDraftSchema>;

/**
 * Draft endpoints return the draft directly. Keep accepting the older
 * `{ draft }` envelope so client transitions remain compatible with any
 * already-deployed response.
 */
export function parseApplicationDraftResponse(value: unknown): ApplicationDraft {
  const payload =
    value && typeof value === "object" && !Array.isArray(value) && "draft" in value
      ? (value as { draft?: unknown }).draft
      : value;
  return applicationDraftSchema.parse(payload);
}

export const saveApplicationDraftCommandSchema = z
  .object({
    jobId: idSchema,
    expectedRevision: z.number().int().positive().nullable(),
    personalInformation: candidatePersonalInfoSchema,
    cvVersionId: idSchema.nullable(),
    coverLetter: coverLetterDraftSchema.nullable(),
    message: z.string().max(2_000).nullable(),
    confirmationAccepted: z.boolean(),
  })
  .strict();

export type SaveApplicationDraftCommand = z.infer<
  typeof saveApplicationDraftCommandSchema
>;

export const applicationReviewSchema = z
  .object({
    job: z
      .object({
        id: idSchema,
        slug: z.string().trim().min(1).max(220),
        title: z.string().trim().min(1).max(200),
        companyName: z.string().trim().min(1).max(160),
        location: z.string().trim().min(1).max(300),
        isOpen: z.boolean(),
      })
      .strict(),
    draft: applicationDraftSchema,
  })
  .strict();

export type ApplicationReview = z.infer<typeof applicationReviewSchema>;

export const applicationSubmitCommandSchema = z
  .object({
    draftId: idSchema,
    expectedRevision: z.number().int().positive(),
    informationConfirmed: z.literal(true),
  })
  .strict();

export type ApplicationSubmitCommand = z.infer<
  typeof applicationSubmitCommandSchema
>;

export const intakeStateSchema = z.enum([
  "RECEIVED",
  "CHECKING_FILES",
  "SENT_TO_RECRUITER",
  "ATTENTION_REQUIRED",
]);
export type IntakeState = z.infer<typeof intakeStateSchema>;

export const intakeStepCodeSchema = z.enum([
  "APPLICATION_RECEIVED",
  "CHECKING_FILES",
  "SENT_TO_RECRUITER",
]);
export type IntakeStepCode = z.infer<typeof intakeStepCodeSchema>;

export const intakeStepStatusSchema = z.enum([
  "PENDING",
  "ACTIVE",
  "COMPLETE",
  "ATTENTION_REQUIRED",
]);

export const applicationIntakeSchema = z
  .object({
    state: intakeStateSchema,
    progressPercent: z.number().int().min(0).max(100),
    steps: z
      .array(
        z
          .object({
            code: intakeStepCodeSchema,
            status: intakeStepStatusSchema,
            timestamp: isoDateTime.nullable(),
          })
          .strict(),
      )
      .length(3),
    failureCode: z.string().trim().min(1).max(80).nullable(),
    updatedAt: isoDateTime,
  })
  .strict();

export type ApplicationIntake = z.infer<typeof applicationIntakeSchema>;

export const publicStageSchema = z.enum([
  "APPLICATION_SUBMITTED",
  "UNDER_REVIEW",
  "INTERVIEW",
  "OUTCOME",
]);
export type PublicStage = z.infer<typeof publicStageSchema>;

export const publicOutcomeSchema = z.enum([
  "OFFERED",
  "HIRED",
  "OFFER_DECLINED",
  "REJECTED",
  "WITHDRAWN",
]);
export type PublicOutcome = z.infer<typeof publicOutcomeSchema>;

export const publicUpdateKindSchema = z.enum([
  "SUBMITTED",
  "UNDER_REVIEW",
  "INTERVIEW",
  "OUTCOME",
  "WITHDRAWN",
  "TECHNICAL_UPDATE",
]);

export const applicationPublicUpdateSchema = z
  .object({
    id: idSchema,
    kind: publicUpdateKindSchema,
    publicStage: publicStageSchema.nullable().optional(),
    publicOutcome: publicOutcomeSchema.nullable().optional(),
    title: z.string().trim().min(1).max(160),
    occurredAt: isoDateTime,
  })
  .strict();

export type ApplicationPublicUpdate = z.infer<
  typeof applicationPublicUpdateSchema
>;

export const notificationPreferenceSchema = z
  .object({
    emailEnabled: z.boolean(),
    inAppEnabled: z.boolean(),
    version: z.number().int().positive(),
    updatedAt: isoDateTime,
  })
  .strict();

export type ApplicationNotificationPreference = z.infer<
  typeof notificationPreferenceSchema
>;

const publicFileSchema = applicationFileDescriptorSchema;

export const applicationTrackerSchema = z
  .object({
    applicationId: idSchema,
    job: z
      .object({
        jobId: idSchema,
        slug: z.string().trim().min(1).max(220).nullable(),
        title: z.string().trim().min(1).max(200),
        companyName: z.string().trim().min(1).max(160),
        companyLogoUrl: z.string().url().nullable(),
        location: z.string().trim().min(1).max(300),
        jobAvailable: z.boolean(),
      })
      .strict(),
    publicStage: publicStageSchema,
    publicOutcome: publicOutcomeSchema.nullable(),
    canonicalStage: applicationStageSchema,
    stageVersion: z.number().int().positive(),
    submittedAt: isoDateTime,
    lastUpdatedAt: isoDateTime,
    intake: applicationIntakeSchema,
    updates: z.array(applicationPublicUpdateSchema).max(500),
    files: z.array(publicFileSchema).min(1).max(2),
    notificationPreference: notificationPreferenceSchema,
    canWithdraw: z.boolean(),
  })
  .strict();

export type ApplicationTracker = z.infer<typeof applicationTrackerSchema>;

export const applicationReceiptSchema = z
  .object({
    applicationId: idSchema,
    submittedAt: isoDateTime,
    publicStage: z.literal("APPLICATION_SUBMITTED"),
    intake: applicationIntakeSchema,
    files: z.array(publicFileSchema).min(1).max(2),
  })
  .strict();

export type ApplicationReceipt = z.infer<typeof applicationReceiptSchema>;

export const withdrawalCommandSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    confirmed: z.literal(true),
  })
  .strict();

export const withdrawalOutcomeSchema = z
  .object({
    applicationId: idSchema,
    outcome: z.literal("WITHDRAWN"),
    withdrawnAt: isoDateTime,
    preservedStage: z.enum(["APPLIED", "VIEWED", "SHORTLISTED", "WAITLISTED"]),
    version: z.number().int().positive(),
  })
  .strict();

export type WithdrawalOutcome = z.infer<typeof withdrawalOutcomeSchema>;

export const notificationPreferenceUpdateSchema = z
  .object({
    emailEnabled: z.boolean(),
    inAppEnabled: z.boolean(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const candidateApplicationSummarySchema = z
  .object({
    applicationId: idSchema,
    jobId: idSchema,
    jobSlug: z.string().trim().min(1).max(220).nullable(),
    jobTitle: z.string().trim().min(1).max(200),
    companyName: z.string().trim().min(1).max(160),
    companyLogoUrl: z.string().url().nullable(),
    location: z.string().trim().min(1).max(300),
    publicStage: publicStageSchema,
    publicOutcome: publicOutcomeSchema.nullable(),
    canonicalStage: applicationStageSchema,
    stageVersion: z.number().int().positive(),
    submittedAt: isoDateTime,
    lastUpdatedAt: isoDateTime,
    jobAvailable: z.boolean(),
  })
  .strict();

export const candidateApplicationListResponseSchema = z
  .object({
    applications: z.array(candidateApplicationSummarySchema).max(100),
    nextCursor: idSchema.nullable(),
  })
  .strict();

export type CandidateApplicationSummary = z.infer<
  typeof candidateApplicationSummarySchema
>;

export function publicStageForCanonicalStage(stage: ApplicationStage): PublicStage {
  if (stage === "INTERVIEWING") return "INTERVIEW";
  if (["OFFERED", "HIRED", "OFFER_DECLINED", "REJECTED"].includes(stage)) {
    return "OUTCOME";
  }
  if (["VIEWED", "SHORTLISTED", "WAITLISTED"].includes(stage)) {
    return "UNDER_REVIEW";
  }
  return "APPLICATION_SUBMITTED";
}

export function publicOutcomeForCanonicalStage(
  stage: ApplicationStage,
): PublicOutcome | null {
  if (stage === "OFFERED" || stage === "HIRED" || stage === "OFFER_DECLINED" || stage === "REJECTED") {
    return stage;
  }
  return null;
}
