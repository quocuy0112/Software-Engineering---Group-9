import { z } from "zod";
import { jobReviewSnapshotSchema } from "../recruiter-job-posting";

export const jobPostReviewStateSchema = z.enum([
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
]);

export const jobPostReviewReasonCodeSchema = z.enum([
  "INCOMPLETE_OR_UNCLEAR",
  "MISLEADING_CONTENT",
  "COMPENSATION_OR_LOCATION_UNCLEAR",
  "DISCRIMINATORY_OR_PROHIBITED",
  "COMPANY_OR_ROLE_MISMATCH",
  "DUPLICATE_OR_SPAM",
  "EXPIRED_OR_INVALID_DEADLINE",
  "POLICY_OR_LEGAL_RISK",
  "OTHER_ACTION_REQUIRED",
]);

export const recruiterReviewProjectionSchema = z
  .object({
    reviewId: z.string().min(1).max(128),
    jobId: z.string().min(1).max(128),
    sequence: z.number().int().positive(),
    state: jobPostReviewStateSchema,
    readOnly: z.boolean(),
    reasonCode: jobPostReviewReasonCodeSchema.nullable().optional(),
    publicExplanation: z.string().max(1_000).nullable().optional(),
    submittedAt: z.string().datetime(),
    decidedAt: z.string().datetime().nullable().optional(),
    version: z.number().int().positive(),
  })
  .strict();

export const jobPostReviewQueueItemSchema = z
  .object({
    id: z.string().min(1).max(128),
    jobId: z.string().min(1).max(128),
    jobTitle: z.string().min(1).max(200),
    companyId: z.string().min(1).max(128),
    companyDisplayName: z.string().min(1).max(200),
    sequence: z.number().int().positive(),
    state: jobPostReviewStateSchema,
    assignment: z.string().min(1).max(128).nullable(),
    submittedAt: z.string().datetime(),
    ageSeconds: z.number().int().nonnegative(),
    version: z.number().int().positive(),
    integrityState: z.enum(["VALID", "BLOCKED"]).optional(),
  })
  .strict();

const reviewDecisionSchema = z
  .object({
    adminUserId: z.string().min(1).max(128).nullable(),
    decidedAt: z.string().datetime(),
    publishedAt: z.string().datetime().nullable(),
    reasonCode: jobPostReviewReasonCodeSchema.nullable(),
    publicExplanation: z.string().max(1_000).nullable(),
  })
  .strict();

const reviewHistoryItemSchema = z
  .object({
    id: z.string().min(1).max(128),
    action: z.string().min(1).max(64),
    resultingState: jobPostReviewStateSchema,
    resultingVersion: z.number().int().positive(),
    occurredAt: z.string().datetime(),
  })
  .strict();

const privateNoteSchema = z
  .object({
    id: z.string().min(1).max(128),
    authorAdminUserId: z.string().min(1).max(128),
    normalizedText: z.string().min(1).max(2_000),
    createdAt: z.string().datetime(),
  })
  .strict();

export const jobPostReviewDetailSchema = jobPostReviewQueueItemSchema
  .omit({ jobTitle: true, companyDisplayName: true })
  .extend({
    snapshot: jobReviewSnapshotSchema,
    snapshotSchemaVersion: z.string().min(1).max(32),
    snapshotSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    company: z
      .object({
        id: z.string().min(1).max(128),
        displayName: z.string().min(1).max(200),
        verificationState: z.string().min(1).max(64),
        active: z.boolean(),
        protectedVerificationHref: z.string().max(500).nullable().optional(),
      })
      .strict(),
    submitter: z
      .object({
        accountId: z.string().min(1).max(128),
        displayName: z.string().min(1).max(200),
        membershipState: z.string().min(1).max(64),
        currentlyEligible: z.boolean(),
      })
      .strict(),
    priorApprovedSnapshot: jobReviewSnapshotSchema.nullable().optional(),
    decision: reviewDecisionSchema.nullable(),
    history: z.array(reviewHistoryItemSchema),
    privateNotes: z.array(privateNoteSchema),
  })
  .strict();

const normalizedPrivateNoteSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_000)
  .refine(
    (value) =>
      !Array.from(value).some((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code < 32 || code === 127;
      }),
    { message: "Control characters are not allowed." },
  );

export const adminReviewCommandSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("CLAIM") }).strict(),
  z
    .object({
      command: z.literal("REASSIGN"),
      targetAdminUserId: z.string().min(1).max(128),
      privateNote: normalizedPrivateNoteSchema.optional(),
    })
    .strict(),
  z.object({ command: z.literal("APPROVE") }).strict(),
  z
    .object({
      command: z.literal("REJECT"),
      reasonCode: jobPostReviewReasonCodeSchema,
      publicExplanation: z.string().trim().min(20).max(1_000),
      privateNote: normalizedPrivateNoteSchema.optional(),
    })
    .strict(),
]);

export const adminReviewCommandResultSchema = z
  .object({
    reviewId: z.string().min(1).max(128),
    state: jobPostReviewStateSchema,
    assignedAdminUserId: z.string().min(1).max(128).nullable(),
    version: z.number().int().positive(),
    correlationId: z.string().min(1).max(128),
  })
  .strict();

export type JobPostReviewState = z.infer<typeof jobPostReviewStateSchema>;
export type JobPostReviewReasonCode = z.infer<
  typeof jobPostReviewReasonCodeSchema
>;
export type AdminReviewCommand = z.infer<typeof adminReviewCommandSchema>;
