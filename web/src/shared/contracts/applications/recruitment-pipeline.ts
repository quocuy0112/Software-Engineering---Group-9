import { z } from "zod";
import {
  applicationStageSchema,
  applicationStageTransitionOutcomeSchema,
  applicationStageTransitionSchema,
  type ApplicationStage,
  type ApplicationStageTransition,
} from "@/shared/contracts/jobs/applications";
import { rejectionReasonCodeSchema } from "@/shared/contracts/scoring";

const isoDateTimeSchema = z.string().datetime();

export const pipelineApplicationStages = applicationStageSchema.options;

export const terminalPipelineStages = [
  "HIRED",
  "OFFER_DECLINED",
  "REJECTED",
] as const satisfies readonly ApplicationStage[];

export function isTerminalPipelineStage(stage: ApplicationStage) {
  return terminalPipelineStages.includes(stage as (typeof terminalPipelineStages)[number]);
}

export const pipelineStageLabels: Record<ApplicationStage, string> = {
  APPLIED: "Applied",
  VIEWED: "Viewed",
  SHORTLISTED: "Shortlisted",
  INTERVIEWING: "Interviewing",
  OFFERED: "Offered",
  HIRED: "Hired",
  OFFER_DECLINED: "Offer Declined",
  REJECTED: "Rejected",
  WAITLISTED: "Waitlisted",
};

export const pipelineMembershipRoleSchema = z.enum([
  "OWNER",
  "HR_MANAGER",
  "RECRUITER",
  "HIRING_MANAGER",
]);

export const pipelinePermissionsSchema = z
  .object({
    role: pipelineMembershipRoleSchema,
    canView: z.literal(true),
    canMoveStages: z.boolean(),
    canReject: z.boolean(),
    canRecordOfferDeclined: z.boolean(),
    canConfirmHired: z.boolean(),
  })
  .strict();

export const pipelineStageCountSchema = z
  .object({
    stage: applicationStageSchema,
    label: z.enum([
      "Applied",
      "Viewed",
      "Shortlisted",
      "Interviewing",
      "Offered",
      "Hired",
      "Offer Declined",
      "Rejected",
      "Waitlisted",
    ]),
    count: z.number().int().min(0).max(10_000),
  })
  .strict();

export const pipelineBoardMetadataSchema = z
  .object({
    job: z
      .object({
        jobId: z.string().min(1).max(128),
        title: z.string().min(1).max(200),
        status: z.enum(["ACTIVE", "CLOSED"]),
      })
      .strict(),
    permissions: pipelinePermissionsSchema,
    stages: z.array(pipelineStageCountSchema).length(9),
    /** Changes whenever a visible application stage or score is persisted. */
    revisionAt: isoDateTimeSchema.nullable().optional(),
    observedAt: isoDateTimeSchema,
  })
  .strict();

export const pipelineScoreBandSchema = z
  .object({
    code: z.enum(["HIGH_MATCH", "MEDIUM_MATCH", "LOW_MATCH"]),
    label: z.enum(["Strong match", "Review needed", "Low match"]),
  })
  .strict();

export const pipelineScoreSchema = z
  .object({
    state: z.enum([
      "NOT_CALCULATED",
      "PENDING",
      "PROCESSING",
      "SCORED",
      "UNAVAILABLE",
    ]),
    final: z.number().min(0).max(100).nullable(),
    /** The AI-only Smart Match score, shown separately from the final score. */
    aiScore: z.number().min(0).max(100).nullable().optional(),
    /** The final-score tier used by automatic recruitment-stage rules. */
    band: pipelineScoreBandSchema.nullable(),
    /** The AI-only Smart Match tier, shown separately from the final tier. */
    aiScoreBand: pipelineScoreBandSchema.nullable().optional(),
  })
  .strict();

export const pipelineApplicationCardSchema = z
  .object({
    applicationId: z.string().min(1).max(128),
    candidate: z
      .object({
        displayName: z.string().min(1).max(200),
        avatarUrl: z.string().url().nullable(),
      })
      .strict(),
    submittedAt: isoDateTimeSchema,
    stage: applicationStageSchema,
    stageVersion: z.number().int().min(1),
    documents: z
      .object({
        cvAvailable: z.boolean(),
        coverLetterAvailable: z.boolean(),
      })
      .strict(),
    score: pipelineScoreSchema.nullable(),
    allowedDestinations: z.array(applicationStageSchema).max(8),
    /** Droppable targets are narrower than button destinations. */
    dragDestinations: z.array(applicationStageSchema).max(8).optional(),
  })
  .strict();

export const pipelineStagePageSchema = z
  .object({
    stage: applicationStageSchema,
    items: z.array(pipelineApplicationCardSchema).max(100),
    nextCursor: z.string().min(1).max(512).nullable(),
    observedAt: isoDateTimeSchema,
  })
  .strict();

export const pipelineStagePageQuerySchema = z
  .object({
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const idempotencyKeySchema = z.string().min(16).max(128);

export const stageTransitionCommandSchema = z
  .object({
    targetStage: applicationStageSchema,
    expectedStageVersion: z.number().int().min(1),
    intent: z.enum(["button", "drag"]).optional(),
    confirmed: z.boolean().optional(),
    reasonCode: z.string().min(1).max(80).optional(),
    candidateVisibleReason: z.string().min(1).max(500).optional(),
    internalNote: z.string().min(1).max(2_000).optional(),
  })
  .strict();

export const stageTransitionOutcomeSchema = z
  .object({
    applicationId: z.string().min(1).max(128),
    fromStage: applicationStageSchema,
    stage: applicationStageSchema,
    stageVersion: z.number().int().min(2),
    lastStageChangedAt: isoDateTimeSchema,
    stageEventId: z.string().min(1),
    replayed: z.boolean(),
    allowedDestinations: z.array(applicationStageSchema).max(8),
  })
  .strict();

export const pipelineProblemCodeSchema = z.enum([
  "INVALID_REQUEST",
  "VALIDATION_ERROR",
  "AUTHENTICATION_REQUIRED",
  "ACCOUNT_UNAVAILABLE",
  "REQUEST_FORBIDDEN",
  "APPLICATION_UNAVAILABLE",
  "APPLICATION_STAGE_CONFLICT",
  "APPLICATION_STAGE_TRANSITION_INVALID",
  "APPLICATION_STAGE_REASON_REQUIRED",
  "APPLICATION_STAGE_REASON_INVALID",
  "APPLICATION_STAGE_CONFIRMATION_REQUIRED",
  "IDEMPOTENCY_KEY_REQUIRED",
  "IDEMPOTENCY_CONFLICT",
  "JOB_SERVICE_UNAVAILABLE",
]);

export const pipelineProblemSchema = z
  .object({
    code: pipelineProblemCodeSchema,
    message: z.string().min(1).max(200),
  })
  .strict();

export const stageConflictCodeSchema = z.enum([
  "APPLICATION_STAGE_CONFLICT",
  "APPLICATION_STAGE_TRANSITION_INVALID",
  "IDEMPOTENCY_CONFLICT",
]);

export const stageConflictSchema = z
  .object({
    code: stageConflictCodeSchema,
    message: z.string().min(1).max(200),
    current: z
      .object({
        stage: applicationStageSchema,
        stageVersion: z.number().int().min(1),
      })
      .strict()
      .optional(),
  })
  .strict();

export {
  applicationStageSchema,
  applicationStageTransitionOutcomeSchema,
  applicationStageTransitionSchema,
  rejectionReasonCodeSchema,
};
export type { ApplicationStage, ApplicationStageTransition };

export type PipelineMembershipRole = z.infer<typeof pipelineMembershipRoleSchema>;
export type PipelinePermissions = z.infer<typeof pipelinePermissionsSchema>;
export type PipelineStageCount = z.infer<typeof pipelineStageCountSchema>;
export type PipelineBoardMetadata = z.infer<typeof pipelineBoardMetadataSchema>;
export type PipelineScore = z.infer<typeof pipelineScoreSchema>;
export type PipelineApplicationCard = z.infer<typeof pipelineApplicationCardSchema>;
export type PipelineStagePage = z.infer<typeof pipelineStagePageSchema>;
export type StageTransitionCommand = z.infer<typeof stageTransitionCommandSchema>;
export type StageTransitionOutcome = z.infer<typeof stageTransitionOutcomeSchema>;
export type PipelineProblem = z.infer<typeof pipelineProblemSchema>;
export type StageConflict = z.infer<typeof stageConflictSchema>;
