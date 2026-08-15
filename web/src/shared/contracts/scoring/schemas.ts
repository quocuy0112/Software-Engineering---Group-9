import { z } from "zod";

const isoDateTime = z.string().datetime();

export const explicitLabelSchema = z.object({
  code: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  iconLabel: z.string().min(1).max(80),
}).strict();

export const parseStatusSchema = z.object({
  code: z.enum(["PARSED_SUCCESSFULLY", "PARSED_WITH_ERRORS", "FAILED"]),
  label: z.enum(["Parsed successfully", "Parsed with errors", "Failed"]),
  parserVersion: z.string().min(1).max(80),
  processingMilliseconds: z.number().int().nonnegative(),
  snapshotVersion: z.string().min(1).max(80),
}).strict();

export const evidenceExcerptSchema = z.object({
  excerpt: z.string().min(1).max(2_000),
  pageNumber: z.number().int().positive().optional(),
  sectionLabel: z.string().min(1).max(120).optional(),
  cvSnapshotVersion: z.string().min(1).max(80),
  parserVersion: z.string().min(1).max(80),
}).strict().refine(
  (value) => value.pageNumber !== undefined || value.sectionLabel !== undefined,
  { message: "Evidence needs a page or section reference." },
);

export const skillEvidenceSchema = z.object({
  skillCode: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  requirementKind: z.enum(["REQUIRED", "PREFERRED"]),
  matchState: z.enum(["FOUND", "MISSING", "NEUTRAL_PREFERRED"]),
  evidence: z.array(evidenceExcerptSchema),
}).strict();

export const detectedExperienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("DETECTED"), years: z.number().nonnegative(), label: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("NOT_DETECTED"), label: z.literal("Not detected") }).strict(),
]);

export const automaticMatchSchema = z.object({
  resultId: z.string().min(1),
  score: z.number().min(0).max(100),
  cvVersion: z.string().min(1),
  jdVersion: z.string().min(1),
  configVersion: z.string().min(1),
  parserVersion: z.string().min(1),
  cvParse: parseStatusSchema,
  jdParse: parseStatusSchema,
  mayBeIncomplete: z.boolean(),
  incompletenessLabel: z.string().min(1).nullable(),
  foundRequiredSkills: z.array(skillEvidenceSchema),
  missingRequiredSkills: z.array(skillEvidenceSchema),
  preferredSkills: z.array(skillEvidenceSchema),
  minimumExperienceYears: z.number().nonnegative().nullable(),
  detectedExperience: detectedExperienceSchema,
}).strict();

export const aiFindingSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["STRENGTH", "POINT_TO_VERIFY"]),
  title: z.string().min(1).max(160),
  evidence: z.string().min(1).max(2_000),
}).strict();

export const aiDataQualityNoteSchema = z.object({
  id: z.string().min(1),
  bucket: z.enum(["input_limitation", "extraction_uncertainty"]),
  title: z.string().min(1).max(160),
  evidence: z.string().min(1).max(2_000),
}).strict();

export const aiQuestionsSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("GENERATED"),
    items: z.array(z.object({ question: z.string().min(1).max(500), pointToVerifyId: z.string().min(1) }).strict()).min(1).max(10),
  }).strict(),
  z.object({ kind: z.literal("INSUFFICIENT_DATA"), fallbackMessage: z.string().min(1).max(300) }).strict(),
]);

export const aiAssessmentSchema = z.object({
  assessmentId: z.string().min(1),
  score: z.number().min(0).max(100),
  confidencePercent: z.number().int().min(0).max(100),
  confidenceLevel: z.enum(["LOW", "STANDARD"]),
  confidenceLabel: z.string().min(1),
  humanReviewGuidance: z.string().min(1).nullable(),
  requiresHumanReview: z.boolean(),
  provider: z.string().min(1),
  modelVersion: z.string().min(1),
  promptVersion: z.string().min(1),
  policyVersion: z.string().min(1),
  overallSummary: z.string().min(1),
  breakdown: z.array(z.string().min(1).max(300)).length(3),
  assessmentLimitedByDataQuality: z.boolean(),
  dataQualityNotes: z.array(aiDataQualityNoteSchema).max(30),
  findings: z.array(aiFindingSchema),
  compliance: z.object({
    code: z.literal("SENSITIVE_ATTRIBUTES_EXCLUDED"),
    label: z.literal("Sensitive personal attributes are excluded from scoring."),
  }).strict(),
  questions: aiQuestionsSchema,
}).strict();

export const finalScoreSchema = z.object({
  value: z.number().min(0).max(100).multipleOf(0.1),
  formulaText: z.string().min(1),
  formulaVersion: z.string().min(1),
  automaticWeight: z.literal(0.6),
  aiWeight: z.literal(0.4),
  band: explicitLabelSchema,
  cvVersion: z.string().min(1),
  jdVersion: z.string().min(1),
  configVersion: z.string().min(1),
  computedAt: isoDateTime,
}).strict();

const notCalculatedStateSchema = z.object({
  kind: z.literal("NOT_CALCULATED"),
  label: z.literal("Not calculated"),
}).strict();

const pendingStateSchema = z.object({
  kind: z.literal("PENDING"),
  label: z.literal("Pending"),
  operationId: z.string().min(1),
  automaticMatch: automaticMatchSchema.nullable(),
}).strict();

const processingStateSchema = z.object({
  kind: z.literal("PROCESSING"),
  label: z.literal("Processing"),
  operationId: z.string().min(1),
}).strict();

const unavailableStateSchema = z.object({
  kind: z.literal("UNAVAILABLE"),
  label: z.literal("Unavailable"),
  automaticMatch: automaticMatchSchema,
  aiAssessment: z.object({
    kind: z.literal("UNAVAILABLE"),
    label: z.literal("Unavailable"),
    safeFailureCode: z.string().min(1),
    supportGuidance: z.string().min(1).nullable(),
  }).strict(),
  finalScore: notCalculatedStateSchema,
  retryAllowed: z.boolean(),
  consecutiveFailures: z.number().int().positive(),
}).strict();

const scoredStateSchema = z.object({
  kind: z.literal("SCORED"),
  label: z.literal("Scored"),
  automaticMatch: automaticMatchSchema,
  aiAssessment: aiAssessmentSchema,
  finalScore: finalScoreSchema,
}).strict();

export const scoringStateSchema = z.discriminatedUnion("kind", [
  notCalculatedStateSchema,
  pendingStateSchema,
  processingStateSchema,
  unavailableStateSchema,
  scoredStateSchema,
]);

export const activeFilterChipSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  removeToken: z.string().min(1),
}).strict();

export const actionAvailabilitySchema = z.discriminatedUnion("allowed", [
  z.object({ allowed: z.literal(true), label: z.string().min(1) }).strict(),
  z.object({ allowed: z.literal(false), label: z.string().min(1), reasonCode: z.string().min(1), reasonLabel: z.string().min(1) }).strict(),
]);

const rankedRowScoringStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("NOT_CALCULATED"), label: z.literal("Not calculated") }).strict(),
  z.object({ kind: z.literal("PENDING"), label: z.literal("Pending"), operationId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("PROCESSING"), label: z.literal("Processing"), operationId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("UNAVAILABLE"), label: z.literal("Unavailable") }).strict(),
  z.object({ kind: z.literal("SCORED"), label: z.literal("Scored") }).strict(),
]);

export const manualPrioritySchema = z.object({
  id: z.string().min(1),
  value: z.enum(["HIGH", "NORMAL", "LOW", "HOLD"]),
  label: z.string().min(1),
  reason: z.string().min(1),
  actorUserId: z.string().min(1),
  setAt: isoDateTime,
  version: z.number().int().positive(),
  active: z.literal(true),
}).strict();

export const rankedApplicationRowSchema = z.object({
  applicationId: z.string().min(1),
  stage: z.enum(["APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEWING", "OFFERED", "HIRED", "OFFER_DECLINED", "REJECTED", "WAITLISTED"]),
  stageVersion: z.number().int().positive(),
  submittedAt: isoDateTime,
  candidate: z.object({ displayName: z.string().min(1), verifiedEmail: z.string().email(), avatarUrl: z.string().url().nullable() }).strict(),
  experienceYears: z.number().nonnegative().nullable(),
  skills: z.array(z.string().min(1)),
  scoring: rankedRowScoringStateSchema,
  scoreSummary: z.object({ automatic: z.number().min(0).max(100).nullable(), ai: z.number().min(0).max(100).nullable(), final: z.number().min(0).max(100).nullable(), band: explicitLabelSchema.nullable() }).strict(),
  manuallyPrioritized: z.boolean(),
  manualPriority: manualPrioritySchema.nullable(),
  allowedActions: z.object({ moveToInterview: actionAvailabilitySchema, reject: actionAvailabilitySchema }).strict(),
}).strict().refine((row) => row.scoring.kind === "SCORED" ? row.scoreSummary.final !== null : row.scoreSummary.final === null, { message: "Only a scored row may carry a numeric final score." });

export const rankedApplicationPageSchema = z.object({
  items: z.array(rankedApplicationRowSchema).max(100),
  nextCursor: z.string().min(1).nullable(),
  rankingSnapshotId: z.string().min(1),
  activeFilters: z.array(activeFilterChipSchema),
  processingExcludedCount: z.number().int().nonnegative(),
  processingExclusionLabel: z.string().min(1).nullable(),
  defaultRejectedExclusionLabel: z.string().min(1).nullable(),
  rescoreInProgress: z.boolean(),
  filteredCandidates: z.number().int().nonnegative(),
  totalCandidates: z.number().int().nonnegative(),
  summary: z.object({ total: z.number().int().nonnegative(), strong: z.number().int().nonnegative(), review: z.number().int().nonnegative(), low: z.number().int().nonnegative(), processing: z.number().int().nonnegative() }).strict(),
}).strict();

export const rankedListQuerySchema = z.object({
  cursor: z.string().min(1).max(1_024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["FINAL_SCORE", "MANUAL_PRIORITY", "SUBMITTED_AT"]).default("FINAL_SCORE"),
  search: z.string().trim().max(120).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  maxScore: z.coerce.number().min(0).max(100).optional(),
  skill: z.string().trim().max(120).optional(),
  minExperience: z.coerce.number().min(0).max(100).optional(),
  stage: z.enum(["ACTIVE_PIPELINE", "ALL", "APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEWING", "OFFERED", "HIRED", "OFFER_DECLINED", "REJECTED", "WAITLISTED"]).default("ACTIVE_PIPELINE"),
  scoringStatus: z.enum(["ALL", "PROCESSING", "SCORED", "UNAVAILABLE", "NOT_CALCULATED"]).default("ALL"),
}).strict().refine((value) => value.minScore === undefined || value.maxScore === undefined || value.minScore <= value.maxScore, { message: "Invalid score range." });

export const scoringOperationSchema = z.object({
  operationId: z.string().min(1),
  kind: z.enum(["INITIAL", "JOB_RESCORE", "AI_RETRY"]),
  state: z.enum(["QUEUED", "RUNNING", "COMPLETED", "COMPLETED_WITH_FAILURES", "FAILED"]),
  totalCount: z.number().int().nonnegative(),
  succeededCount: z.number().int().nonnegative(),
  deterministicOnlyCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  requestedAt: isoDateTime,
  completedAt: isoDateTime.nullable(),
}).strict();

export const scoringDetailSchema = z.object({
  applicationId: z.string().min(1),
  humanDecisionNotice: z.literal("Scores support decision-making only. The recruiter makes the final decision."),
  scoring: scoringStateSchema,
  rescoreInProgress: z.boolean(),
  documentAccess: z.object({ cvViewerPath: z.string().min(1), coverLetterViewerPath: z.string().nullable() }).strict(),
}).strict();

export const confirmedCommandSchema = z.object({ confirmed: z.literal(true) }).strict();

export const rescoreRequestSchema = confirmedCommandSchema.extend({
  jdVersion: z.string().min(1).max(80),
  scoringConfigVersion: z.string().min(1).max(80),
});

export const aiRetryRequestSchema = confirmedCommandSchema;

export const setPriorityRequestSchema = confirmedCommandSchema.extend({
  value: z.enum(["HIGH", "NORMAL", "LOW", "HOLD"]),
  reason: z.string().trim().min(1).max(1_000),
  expectedVersion: z.number().int().nonnegative(),
});

export const removePriorityRequestSchema = confirmedCommandSchema.extend({
  reason: z.string().trim().min(1).max(1_000),
  expectedVersion: z.number().int().positive(),
});

export const rejectionReasonCodeSchema = z.enum([
  "REQUIRED_TECHNICAL_EXPERIENCE_NOT_DEMONSTRATED",
  "INSUFFICIENT_EXPERIENCE",
  "REQUIRED_SKILLS_NOT_DEMONSTRATED",
  "POSITION_FILLED",
  "APPLICATION_WITHDRAWN_BY_CANDIDATE",
  "OTHER_JOB_RELATED_REASON",
]);

export const interviewDecisionRequestSchema = confirmedCommandSchema.extend({
  expectedStageVersion: z.number().int().positive(),
});

export const rejectDecisionRequestSchema = confirmedCommandSchema.extend({
  expectedStageVersion: z.number().int().positive(),
  reasonCode: rejectionReasonCodeSchema,
  internalNote: z.string().max(2_000).optional(),
});

export const decisionOutcomeSchema = z.object({
  applicationId: z.string().min(1),
  fromStage: rankedApplicationRowSchema.shape.stage,
  toStage: rankedApplicationRowSchema.shape.stage,
  stageVersion: z.number().int().min(2),
  stageEventId: z.string().min(1),
  auditEventId: z.string().min(1),
  actorUserId: z.string().min(1),
  decidedAt: isoDateTime,
  reasonCode: z.string().nullable(),
  notification: z.object({ required: z.boolean(), status: z.enum(["NOT_REQUIRED", "PENDING", "SENT", "FAILED_RETRYING"]) }).strict(),
}).strict();

export type ExplicitLabel = z.infer<typeof explicitLabelSchema>;
export type ParseStatus = z.infer<typeof parseStatusSchema>;
export type EvidenceExcerpt = z.infer<typeof evidenceExcerptSchema>;
export type SkillEvidence = z.infer<typeof skillEvidenceSchema>;
export type DetectedExperience = z.infer<typeof detectedExperienceSchema>;
export type AutomaticMatch = z.infer<typeof automaticMatchSchema>;
export type AiAssessment = z.infer<typeof aiAssessmentSchema>;
export type FinalScore = z.infer<typeof finalScoreSchema>;
export type ScoringState = z.infer<typeof scoringStateSchema>;
export type RankedApplicationRow = z.infer<typeof rankedApplicationRowSchema>;
export type RankedApplicationPage = z.infer<typeof rankedApplicationPageSchema>;
export type ScoringDetail = z.infer<typeof scoringDetailSchema>;
export type ScoringOperation = z.infer<typeof scoringOperationSchema>;
export type ManualPriority = z.infer<typeof manualPrioritySchema>;
export type RejectionReasonCode = z.infer<typeof rejectionReasonCodeSchema>;
export type DecisionOutcome = z.infer<typeof decisionOutcomeSchema>;
