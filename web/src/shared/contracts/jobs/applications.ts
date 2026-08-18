import { z } from "zod";

export const applicationStageSchema = z.enum([
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "INTERVIEWING",
  "OFFERED",
  "HIRED",
  "OFFER_DECLINED",
  "REJECTED",
  "WAITLISTED",
]);

export type ApplicationStage = z.infer<typeof applicationStageSchema>;

export const applicationStageLabel: Record<ApplicationStage, string> = {
  APPLIED: "Applied",
  VIEWED: "Viewed",
  SHORTLISTED: "Shortlisted",
  INTERVIEWING: "Interviewing",
  OFFERED: "Offered",
  HIRED: "Hired",
  OFFER_DECLINED: "Offer declined",
  REJECTED: "Rejected",
  WAITLISTED: "Waitlisted",
};

export const applicationStageGroupSchema = z.enum([
  "ACTIVE",
  "ATTENTION",
  "COMPLETED",
  "PAUSED",
]);

export type ApplicationStageGroup = z.infer<typeof applicationStageGroupSchema>;

export const applicationStageGroup: Record<
  ApplicationStage,
  ApplicationStageGroup
> = {
  APPLIED: "ACTIVE",
  VIEWED: "ACTIVE",
  SHORTLISTED: "ACTIVE",
  INTERVIEWING: "ACTIVE",
  OFFERED: "ATTENTION",
  HIRED: "COMPLETED",
  OFFER_DECLINED: "COMPLETED",
  REJECTED: "COMPLETED",
  WAITLISTED: "PAUSED",
};

export const applicationStageNextStep: Record<ApplicationStage, string> = {
  APPLIED: "Your application has been received and is ready for review.",
  VIEWED: "The hiring team has opened your application.",
  SHORTLISTED: "You are being considered for the next step.",
  INTERVIEWING: "Keep an eye on your messages for interview updates.",
  OFFERED: "Review the offer details and respond through the hiring team.",
  HIRED:
    "Congratulations — the hiring team has marked this application as hired.",
  OFFER_DECLINED:
    "This application is complete because the offer was declined.",
  REJECTED: "The hiring team is not moving forward with this application.",
  WAITLISTED: "Your application is paused and may be considered again.",
};

const isoDateTime = z.string().datetime();

export const candidateApplicationStageEventSchema = z
  .object({
    eventId: z.string().min(1).max(128),
    fromStage: applicationStageSchema.nullable(),
    toStage: applicationStageSchema,
    candidateVisibleReason: z.string().trim().min(1).max(500).nullable(),
    occurredAt: isoDateTime,
    applicationVersion: z.number().int().positive(),
  })
  .strict();

export const candidateApplicationSummarySchema = z
  .object({
    applicationId: z.string().min(1).max(128),
    jobId: z.string().min(1).max(128),
    jobSlug: z.string().min(1).max(220).nullable(),
    jobTitle: z.string().min(1).max(200),
    companyName: z.string().min(1).max(160),
    companyLogoUrl: z.string().url().nullable(),
    location: z.string().min(1).max(300),
    employmentType: z
      .enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "TEMPORARY"])
      .nullable(),
    workArrangement: z.enum(["ONSITE", "HYBRID", "REMOTE"]).nullable(),
    stage: applicationStageSchema,
    stageVersion: z.number().int().positive(),
    submittedAt: isoDateTime,
    lastStageChangedAt: isoDateTime,
    jobAvailable: z.boolean(),
    scoringStatus: z
      .enum(["NOT_REQUESTED", "PENDING", "PROCESSING", "COMPLETED", "FAILED"])
      .optional(),
    aiMatchScore: z.number().int().min(0).max(100).nullable().optional(),
  })
  .strict();

export const candidateApplicationAnswerSchema = z
  .object({
    question: z.string().min(1).max(500),
    answer: z.union([z.string().max(3_000), z.boolean()]),
  })
  .strict();

export const candidateApplicationDetailSchema =
  candidateApplicationSummarySchema.extend({
    coverLetter: z.string().max(5_000).nullable(),
    cv: z
      .object({
        displayName: z.string().min(1).max(200),
        fileName: z.string().min(1).max(255),
      })
      .strict(),
    answers: z.array(candidateApplicationAnswerSchema).max(100),
    history: z.array(candidateApplicationStageEventSchema).max(500),
  });

export const candidateApplicationListResponseSchema = z
  .object({
    applications: z.array(candidateApplicationSummarySchema).max(100),
    nextCursor: z.string().min(1).max(512).nullable(),
  })
  .strict();

export const applicationStageTransitionSchema = z
  .object({
    targetStage: applicationStageSchema,
    expectedVersion: z.number().int().positive(),
    reasonCode: z.string().trim().min(1).max(80).nullable().optional(),
    candidateVisibleReason: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .nullable()
      .optional(),
  })
  .strict();

export const applicationStageTransitionOutcomeSchema = z
  .object({
    applicationId: z.string().min(1).max(128),
    fromStage: applicationStageSchema,
    stage: applicationStageSchema,
    stageVersion: z.number().int().positive(),
    lastStageChangedAt: isoDateTime,
    eventId: z.string().min(1).max(128),
  })
  .strict();

/**
 * Result of an idempotent recruiter stage acknowledgement. Repeated actions
 * return the authoritative stage with `changed: false` once the application
 * has advanced beyond the action's source stage.
 */
export const applicationStageActionOutcomeSchema = z
  .object({
    applicationId: z.string().min(1).max(128),
    stage: applicationStageSchema,
    stageVersion: z.number().int().positive(),
    lastStageChangedAt: isoDateTime,
    changed: z.boolean(),
  })
  .strict();

export const applicationViewedOutcomeSchema =
  applicationStageActionOutcomeSchema;
export const applicationShortlistOutcomeSchema =
  applicationStageActionOutcomeSchema;

export type CandidateApplicationSummary = z.infer<
  typeof candidateApplicationSummarySchema
>;
export type CandidateApplicationDetail = z.infer<
  typeof candidateApplicationDetailSchema
>;
export type CandidateApplicationStageEvent = z.infer<
  typeof candidateApplicationStageEventSchema
>;
export type ApplicationStageTransition = z.infer<
  typeof applicationStageTransitionSchema
>;
export type ApplicationViewedOutcome = z.infer<
  typeof applicationViewedOutcomeSchema
>;
export type ApplicationShortlistOutcome = z.infer<
  typeof applicationShortlistOutcomeSchema
>;
