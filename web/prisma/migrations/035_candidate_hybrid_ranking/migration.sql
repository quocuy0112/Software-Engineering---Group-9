-- Feature 015: immutable scoring generations and recruiter decisions.
-- JobApplication, ApplicationStageEvent, AuditEvent, and Group 1 document
-- access remain authoritative; these tables add versioned scoring evidence.

DO $$ BEGIN
  CREATE TYPE "ScoringResultState" AS ENUM ('DETERMINISTIC_ONLY', 'SCORED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ScoringParseStatus" AS ENUM ('PARSED_SUCCESSFULLY', 'PARSED_WITH_ERRORS', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ScoringSkillRequirementKind" AS ENUM ('REQUIRED', 'PREFERRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ScoringSkillMatchState" AS ENUM ('FOUND', 'MISSING', 'NEUTRAL_PREFERRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ScoringAiConfidenceLevel" AS ENUM ('LOW', 'STANDARD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ScoringAiQuestionState" AS ENUM ('GENERATED', 'INSUFFICIENT_DATA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ScoringOperationKind" AS ENUM ('INITIAL', 'JOB_RESCORE', 'AI_RETRY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ScoringOperationState" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_FAILURES', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ScoringWorkItemState" AS ENUM ('QUEUED', 'LEASED', 'AUTOMATIC_READY', 'AI_PENDING', 'PUBLISHED', 'DETERMINISTIC_ONLY', 'FAILED', 'SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ManualPriorityValue" AS ENUM ('HIGH', 'NORMAL', 'LOW', 'HOLD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ScoringDecisionKind" AS ENUM ('MOVE_TO_INTERVIEW', 'REJECT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ScoringNotificationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SENT', 'FAILED_RETRYING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "JobApplication"
  ADD COLUMN IF NOT EXISTS "currentScoringResultId" TEXT,
  ADD COLUMN IF NOT EXISTS "scoringGeneration" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ApplicationStageEvent"
  ADD COLUMN IF NOT EXISTS "decisionKind" "ScoringDecisionKind",
  ADD COLUMN IF NOT EXISTS "reasonLabelSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "internalNoteEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "notificationRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "notificationStatus" "ScoringNotificationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE TABLE IF NOT EXISTS "AutomaticMatchResult" (
  "id" TEXT NOT NULL,
  "jobApplicationId" TEXT NOT NULL,
  "jobDescriptionVersionId" TEXT NOT NULL,
  "cvSnapshotVersionId" TEXT NOT NULL,
  "scoringConfigVersionId" TEXT NOT NULL,
  "parserBundleVersion" TEXT NOT NULL,
  "score" DECIMAL(5,2) NOT NULL,
  "requiredSkillPoints" DECIMAL(5,2) NOT NULL,
  "experiencePoints" DECIMAL(5,2) NOT NULL,
  "preferredSkillBonus" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "minimumExperienceYears" DECIMAL(5,2),
  "detectedExperienceYears" DECIMAL(5,2),
  "experienceInterpretationCode" TEXT NOT NULL,
  "experienceInterpretationLabel" TEXT NOT NULL,
  "mayBeIncomplete" BOOLEAN NOT NULL DEFAULT FALSE,
  "incompletenessLabel" TEXT,
  "computedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomaticMatchResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentParseResult" (
  "id" TEXT NOT NULL,
  "automaticMatchResultId" TEXT NOT NULL,
  "documentKind" TEXT NOT NULL,
  "applicationDocumentId" TEXT,
  "jobDescriptionVersionId" TEXT,
  "snapshotVersion" TEXT NOT NULL,
  "parserName" TEXT NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "status" "ScoringParseStatus" NOT NULL,
  "processingMilliseconds" INTEGER NOT NULL,
  "safeIssueCodes" TEXT[] NOT NULL,
  "parsedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentParseResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SkillEvidenceExtraction" (
  "id" TEXT NOT NULL,
  "automaticMatchResultId" TEXT NOT NULL,
  "skillCanonicalId" TEXT NOT NULL,
  "skillLabel" TEXT NOT NULL,
  "requirementKind" "ScoringSkillRequirementKind" NOT NULL,
  "matchState" "ScoringSkillMatchState" NOT NULL,
  "normalizationVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SkillEvidenceExtraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CvEvidenceExcerpt" (
  "id" TEXT NOT NULL,
  "skillEvidenceExtractionId" TEXT NOT NULL,
  "excerptEncrypted" TEXT NOT NULL,
  "pageNumber" INTEGER,
  "sectionLabel" TEXT,
  "sourceStart" INTEGER,
  "sourceEnd" INTEGER,
  "cvSnapshotVersionId" TEXT NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "accessDeniedAt" TIMESTAMP(3),
  "deleteAfter" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CvEvidenceExcerpt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiAssessment" (
  "id" TEXT NOT NULL,
  "jobApplicationId" TEXT NOT NULL,
  "automaticMatchResultId" TEXT NOT NULL,
  "score" DECIMAL(5,2) NOT NULL,
  "confidencePercent" INTEGER NOT NULL,
  "confidenceLevel" "ScoringAiConfidenceLevel" NOT NULL,
  "confidenceLabel" TEXT NOT NULL,
  "humanReviewGuidance" TEXT,
  "providerAdapterVersion" TEXT NOT NULL,
  "providerModel" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "assessmentSchemaVersion" TEXT NOT NULL,
  "sensitiveAttributePolicyVersion" TEXT NOT NULL,
  "overallSummaryEncrypted" TEXT NOT NULL,
  "technicalAbilitySummaryEncrypted" TEXT NOT NULL,
  "roleFitSummaryEncrypted" TEXT NOT NULL,
  "deductionSummaryEncrypted" TEXT NOT NULL,
  "complianceStatementCode" TEXT NOT NULL,
  "complianceStatementLabel" TEXT NOT NULL,
  "questionState" "ScoringAiQuestionState" NOT NULL,
  "questionFallbackLabel" TEXT,
  "accessDeniedAt" TIMESTAMP(3),
  "deleteAfter" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "computedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiAssessmentFinding" (
  "id" TEXT NOT NULL,
  "aiAssessmentId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "titleEncrypted" TEXT NOT NULL,
  "evidenceEncrypted" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  CONSTRAINT "AiAssessmentFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiSuggestedInterviewQuestion" (
  "id" TEXT NOT NULL,
  "aiAssessmentId" TEXT NOT NULL,
  "pointToVerifyFindingId" TEXT NOT NULL,
  "questionEncrypted" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  CONSTRAINT "AiSuggestedInterviewQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ScoringOperation" (
  "id" TEXT NOT NULL,
  "kind" "ScoringOperationKind" NOT NULL,
  "jobPostingId" TEXT NOT NULL,
  "jobApplicationId" TEXT,
  "requestedByUserId" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL,
  "confirmationIntent" BOOLEAN NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "targetJobDescriptionVersionId" TEXT NOT NULL,
  "targetScoringConfigVersionId" TEXT NOT NULL,
  "reusedAutomaticMatchResultId" TEXT,
  "state" "ScoringOperationState" NOT NULL DEFAULT 'QUEUED',
  "totalCount" INTEGER NOT NULL DEFAULT 0,
  "succeededCount" INTEGER NOT NULL DEFAULT 0,
  "deterministicOnlyCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "supersededCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScoringOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ScoringWorkItem" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "jobApplicationId" TEXT NOT NULL,
  "state" "ScoringWorkItemState" NOT NULL DEFAULT 'QUEUED',
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "consecutiveAiFailureCount" INTEGER NOT NULL DEFAULT 0,
  "lastSafeFailureCode" TEXT,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScoringWorkItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiAssessmentAttempt" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "workItemId" TEXT,
  "jobApplicationId" TEXT NOT NULL,
  "automaticMatchResultId" TEXT NOT NULL,
  "assessmentId" TEXT,
  "providerAdapterVersion" TEXT NOT NULL,
  "providerModel" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "deadlineAt" TIMESTAMP(3) NOT NULL,
  "safeOutcome" TEXT NOT NULL,
  "safeFailureCode" TEXT,
  "attemptNumber" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiAssessmentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApplicationScoringResult" (
  "id" TEXT NOT NULL,
  "jobApplicationId" TEXT NOT NULL,
  "generation" INTEGER NOT NULL,
  "operationId" TEXT NOT NULL,
  "automaticMatchResultId" TEXT NOT NULL,
  "aiAssessmentId" TEXT,
  "automaticScore" DECIMAL(5,2) NOT NULL,
  "aiScore" DECIMAL(5,2),
  "finalScore" DECIMAL(5,2),
  "state" "ScoringResultState" NOT NULL,
  "formulaVersion" TEXT NOT NULL,
  "automaticWeight" DECIMAL(3,2) NOT NULL,
  "aiWeight" DECIMAL(3,2) NOT NULL,
  "highThreshold" DECIMAL(5,2) NOT NULL,
  "mediumThreshold" DECIMAL(5,2) NOT NULL,
  "roundingRule" TEXT NOT NULL,
  "jobDescriptionVersionId" TEXT NOT NULL,
  "cvSnapshotVersionId" TEXT NOT NULL,
  "scoringConfigVersionId" TEXT NOT NULL,
  "parserBundleVersion" TEXT NOT NULL,
  "mayBeIncomplete" BOOLEAN NOT NULL DEFAULT FALSE,
  "incompletenessLabel" TEXT,
  "computedAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "supersededAt" TIMESTAMP(3),
  CONSTRAINT "ApplicationScoringResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicationScoringResult_final_consistency" CHECK (("finalScore" IS NULL AND "aiScore" IS NULL) OR ("finalScore" IS NOT NULL AND "aiScore" IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS "ManualApplicationPriority" (
  "id" TEXT NOT NULL,
  "jobApplicationId" TEXT NOT NULL,
  "value" "ManualPriorityValue" NOT NULL,
  "reasonEncrypted" TEXT NOT NULL,
  "setByUserId" TEXT NOT NULL,
  "setAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "removedByUserId" TEXT,
  "removedAt" TIMESTAMP(3),
  "removalReasonEncrypted" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualApplicationPriority_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RankingSnapshot" (
  "id" TEXT NOT NULL,
  "jobPostingId" TEXT NOT NULL,
  "generation" INTEGER NOT NULL,
  "filterHash" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "sort" TEXT NOT NULL,
  "pageSize" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RankingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RankingSnapshotRow" (
  "id" TEXT NOT NULL,
  "rankingSnapshotId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "rankPosition" INTEGER NOT NULL,
  "scoreState" TEXT NOT NULL,
  "finalScore" DECIMAL(5,2),
  "submittedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RankingSnapshotRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JobApplication_currentScoringResultId_key" ON "JobApplication"("currentScoringResultId");
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationStageEvent_applicationId_idempotencyKey_key" ON "ApplicationStageEvent"("applicationId", "idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ScoringOperation_requestedByUserId_idempotencyKey_key" ON "ScoringOperation"("requestedByUserId", "idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "SkillEvidenceExtraction_result_skill_requirement_key" ON "SkillEvidenceExtraction"("automaticMatchResultId", "skillCanonicalId", "requirementKind");
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationScoringResult_application_generation_key" ON "ApplicationScoringResult"("jobApplicationId", "generation");
CREATE UNIQUE INDEX IF NOT EXISTS "ManualApplicationPriority_application_version_key" ON "ManualApplicationPriority"("jobApplicationId", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "ManualApplicationPriority_one_active_key" ON "ManualApplicationPriority"("jobApplicationId") WHERE "active" = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS "RankingSnapshot_job_generation_key" ON "RankingSnapshot"("jobPostingId", "generation");
CREATE UNIQUE INDEX IF NOT EXISTS "RankingSnapshotRow_snapshot_application_key" ON "RankingSnapshotRow"("rankingSnapshotId", "applicationId");
CREATE UNIQUE INDEX IF NOT EXISTS "RankingSnapshotRow_snapshot_rank_key" ON "RankingSnapshotRow"("rankingSnapshotId", "rankPosition");
CREATE UNIQUE INDEX IF NOT EXISTS "ScoringWorkItem_operation_application_key" ON "ScoringWorkItem"("operationId", "jobApplicationId");

CREATE INDEX IF NOT EXISTS "AutomaticMatchResult_application_computed_idx" ON "AutomaticMatchResult"("jobApplicationId", "computedAt");
CREATE INDEX IF NOT EXISTS "DocumentParseResult_result_kind_idx" ON "DocumentParseResult"("automaticMatchResultId", "documentKind");
CREATE INDEX IF NOT EXISTS "CvEvidenceExcerpt_retention_idx" ON "CvEvidenceExcerpt"("deleteAfter", "deletedAt");
CREATE INDEX IF NOT EXISTS "AiAssessment_application_computed_idx" ON "AiAssessment"("jobApplicationId", "computedAt");
CREATE INDEX IF NOT EXISTS "ScoringOperation_job_state_created_idx" ON "ScoringOperation"("jobPostingId", "state", "createdAt");
CREATE INDEX IF NOT EXISTS "ScoringWorkItem_state_next_idx" ON "ScoringWorkItem"("state", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "ApplicationScoringResult_final_published_idx" ON "ApplicationScoringResult"("finalScore", "publishedAt");
CREATE INDEX IF NOT EXISTS "ManualApplicationPriority_application_active_idx" ON "ManualApplicationPriority"("jobApplicationId", "active");
CREATE INDEX IF NOT EXISTS "RankingSnapshot_job_expiry_idx" ON "RankingSnapshot"("jobPostingId", "expiresAt");

ALTER TABLE "AutomaticMatchResult" ADD CONSTRAINT "AutomaticMatchResult_application_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentParseResult" ADD CONSTRAINT "DocumentParseResult_result_fkey" FOREIGN KEY ("automaticMatchResultId") REFERENCES "AutomaticMatchResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillEvidenceExtraction" ADD CONSTRAINT "SkillEvidenceExtraction_result_fkey" FOREIGN KEY ("automaticMatchResultId") REFERENCES "AutomaticMatchResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvEvidenceExcerpt" ADD CONSTRAINT "CvEvidenceExcerpt_skill_fkey" FOREIGN KEY ("skillEvidenceExtractionId") REFERENCES "SkillEvidenceExtraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiAssessment" ADD CONSTRAINT "AiAssessment_application_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiAssessment" ADD CONSTRAINT "AiAssessment_automatic_fkey" FOREIGN KEY ("automaticMatchResultId") REFERENCES "AutomaticMatchResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiAssessmentFinding" ADD CONSTRAINT "AiAssessmentFinding_assessment_fkey" FOREIGN KEY ("aiAssessmentId") REFERENCES "AiAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSuggestedInterviewQuestion" ADD CONSTRAINT "AiSuggestedInterviewQuestion_assessment_fkey" FOREIGN KEY ("aiAssessmentId") REFERENCES "AiAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSuggestedInterviewQuestion" ADD CONSTRAINT "AiSuggestedInterviewQuestion_finding_fkey" FOREIGN KEY ("pointToVerifyFindingId") REFERENCES "AiAssessmentFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScoringOperation" ADD CONSTRAINT "ScoringOperation_job_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoringOperation" ADD CONSTRAINT "ScoringOperation_application_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoringOperation" ADD CONSTRAINT "ScoringOperation_requester_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScoringWorkItem" ADD CONSTRAINT "ScoringWorkItem_operation_fkey" FOREIGN KEY ("operationId") REFERENCES "ScoringOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoringWorkItem" ADD CONSTRAINT "ScoringWorkItem_application_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiAssessmentAttempt" ADD CONSTRAINT "AiAssessmentAttempt_operation_fkey" FOREIGN KEY ("operationId") REFERENCES "ScoringOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiAssessmentAttempt" ADD CONSTRAINT "AiAssessmentAttempt_work_fkey" FOREIGN KEY ("workItemId") REFERENCES "ScoringWorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiAssessmentAttempt" ADD CONSTRAINT "AiAssessmentAttempt_application_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiAssessmentAttempt" ADD CONSTRAINT "AiAssessmentAttempt_automatic_fkey" FOREIGN KEY ("automaticMatchResultId") REFERENCES "AutomaticMatchResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiAssessmentAttempt" ADD CONSTRAINT "AiAssessmentAttempt_assessment_fkey" FOREIGN KEY ("assessmentId") REFERENCES "AiAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApplicationScoringResult" ADD CONSTRAINT "ApplicationScoringResult_application_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationScoringResult" ADD CONSTRAINT "ApplicationScoringResult_operation_fkey" FOREIGN KEY ("operationId") REFERENCES "ScoringOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationScoringResult" ADD CONSTRAINT "ApplicationScoringResult_automatic_fkey" FOREIGN KEY ("automaticMatchResultId") REFERENCES "AutomaticMatchResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationScoringResult" ADD CONSTRAINT "ApplicationScoringResult_ai_fkey" FOREIGN KEY ("aiAssessmentId") REFERENCES "AiAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_currentScoringResult_fkey" FOREIGN KEY ("currentScoringResultId") REFERENCES "ApplicationScoringResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManualApplicationPriority" ADD CONSTRAINT "ManualApplicationPriority_application_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualApplicationPriority" ADD CONSTRAINT "ManualApplicationPriority_actor_fkey" FOREIGN KEY ("setByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_job_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RankingSnapshotRow" ADD CONSTRAINT "RankingSnapshotRow_snapshot_fkey" FOREIGN KEY ("rankingSnapshotId") REFERENCES "RankingSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RankingSnapshotRow" ADD CONSTRAINT "RankingSnapshotRow_application_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma schema naming alignment generated during local reset.
-- Keep this in the feature migration so a fresh database does not create a second timestamped migration.
-- DropForeignKey
ALTER TABLE "AutomaticMatchResult" DROP CONSTRAINT "AutomaticMatchResult_application_fkey";

-- CreateIndex
CREATE INDEX "AiAssessment_accessDeniedAt_deletedAt_idx" ON "AiAssessment"("accessDeniedAt", "deletedAt");

-- CreateIndex
CREATE INDEX "AiAssessmentAttempt_jobApplicationId_createdAt_idx" ON "AiAssessmentAttempt"("jobApplicationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAssessmentAttempt_operationId_attemptNumber_idx" ON "AiAssessmentAttempt"("operationId", "attemptNumber");

-- CreateIndex
CREATE INDEX "AiAssessmentFinding_aiAssessmentId_ordinal_idx" ON "AiAssessmentFinding"("aiAssessmentId", "ordinal");

-- CreateIndex
CREATE INDEX "AiSuggestedInterviewQuestion_aiAssessmentId_ordinal_idx" ON "AiSuggestedInterviewQuestion"("aiAssessmentId", "ordinal");

-- CreateIndex
CREATE INDEX "AiSuggestedInterviewQuestion_pointToVerifyFindingId_idx" ON "AiSuggestedInterviewQuestion"("pointToVerifyFindingId");

-- CreateIndex
CREATE INDEX "ApplicationCoverLetterText_deleteAfter_deletedAt_idx" ON "ApplicationCoverLetterText"("deleteAfter", "deletedAt");

-- CreateIndex
CREATE INDEX "ApplicationScoringResult_jobApplicationId_publishedAt_idx" ON "ApplicationScoringResult"("jobApplicationId", "publishedAt");

-- CreateIndex
CREATE INDEX "ApplicationScoringResult_jobDescriptionVersionId_scoringCon_idx" ON "ApplicationScoringResult"("jobDescriptionVersionId", "scoringConfigVersionId");

-- CreateIndex
CREATE INDEX "AutomaticMatchResult_cvSnapshotVersionId_jobDescriptionVers_idx" ON "AutomaticMatchResult"("cvSnapshotVersionId", "jobDescriptionVersionId");

-- CreateIndex
CREATE INDEX "CvEvidenceExcerpt_accessDeniedAt_deletedAt_idx" ON "CvEvidenceExcerpt"("accessDeniedAt", "deletedAt");

-- CreateIndex
CREATE INDEX "DocumentParseResult_status_parsedAt_idx" ON "DocumentParseResult"("status", "parsedAt");

-- CreateIndex
CREATE INDEX "JobApplication_jobPostingId_currentScoringResultId_submitte_idx" ON "JobApplication"("jobPostingId", "currentScoringResultId", "submittedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ManualApplicationPriority_setByUserId_setAt_idx" ON "ManualApplicationPriority"("setByUserId", "setAt");

-- CreateIndex
CREATE INDEX "RankingSnapshotRow_applicationId_rankingSnapshotId_idx" ON "RankingSnapshotRow"("applicationId", "rankingSnapshotId");

-- CreateIndex
CREATE INDEX "ScoringOperation_jobApplicationId_kind_state_idx" ON "ScoringOperation"("jobApplicationId", "kind", "state");

-- CreateIndex
CREATE INDEX "ScoringWorkItem_leaseExpiresAt_idx" ON "ScoringWorkItem"("leaseExpiresAt");

-- CreateIndex
CREATE INDEX "SkillEvidenceExtraction_skillCanonicalId_matchState_idx" ON "SkillEvidenceExtraction"("skillCanonicalId", "matchState");

-- RenameForeignKey
ALTER TABLE "AiAssessment" RENAME CONSTRAINT "AiAssessment_application_fkey" TO "AiAssessment_jobApplicationId_fkey";

-- RenameForeignKey
ALTER TABLE "AiAssessment" RENAME CONSTRAINT "AiAssessment_automatic_fkey" TO "AiAssessment_automaticMatchResultId_fkey";

-- RenameForeignKey
ALTER TABLE "AiAssessmentAttempt" RENAME CONSTRAINT "AiAssessmentAttempt_application_fkey" TO "AiAssessmentAttempt_jobApplicationId_fkey";

-- RenameForeignKey
ALTER TABLE "AiAssessmentAttempt" RENAME CONSTRAINT "AiAssessmentAttempt_assessment_fkey" TO "AiAssessmentAttempt_assessmentId_fkey";

-- RenameForeignKey
ALTER TABLE "AiAssessmentAttempt" RENAME CONSTRAINT "AiAssessmentAttempt_automatic_fkey" TO "AiAssessmentAttempt_automaticMatchResultId_fkey";

-- RenameForeignKey
ALTER TABLE "AiAssessmentAttempt" RENAME CONSTRAINT "AiAssessmentAttempt_operation_fkey" TO "AiAssessmentAttempt_operationId_fkey";

-- RenameForeignKey
ALTER TABLE "AiAssessmentAttempt" RENAME CONSTRAINT "AiAssessmentAttempt_work_fkey" TO "AiAssessmentAttempt_workItemId_fkey";

-- RenameForeignKey
ALTER TABLE "AiAssessmentFinding" RENAME CONSTRAINT "AiAssessmentFinding_assessment_fkey" TO "AiAssessmentFinding_aiAssessmentId_fkey";

-- RenameForeignKey
ALTER TABLE "AiSuggestedInterviewQuestion" RENAME CONSTRAINT "AiSuggestedInterviewQuestion_assessment_fkey" TO "AiSuggestedInterviewQuestion_aiAssessmentId_fkey";

-- RenameForeignKey
ALTER TABLE "AiSuggestedInterviewQuestion" RENAME CONSTRAINT "AiSuggestedInterviewQuestion_finding_fkey" TO "AiSuggestedInterviewQuestion_pointToVerifyFindingId_fkey";

-- RenameForeignKey
ALTER TABLE "ApplicationArtifactPromotion" RENAME CONSTRAINT "ApplicationArtifactPromotion_application_fkey" TO "ApplicationArtifactPromotion_jobApplicationId_fkey";

-- RenameForeignKey
ALTER TABLE "ApplicationArtifactPromotion" RENAME CONSTRAINT "ApplicationArtifactPromotion_candidate_fkey" TO "ApplicationArtifactPromotion_candidateUserId_fkey";

-- RenameForeignKey
ALTER TABLE "ApplicationArtifactPromotion" RENAME CONSTRAINT "ApplicationArtifactPromotion_job_fkey" TO "ApplicationArtifactPromotion_jobPostingId_fkey";

-- RenameForeignKey
ALTER TABLE "ApplicationCoverLetterText" RENAME CONSTRAINT "ApplicationCoverLetterText_application_fkey" TO "ApplicationCoverLetterText_jobApplicationId_fkey";

-- RenameForeignKey
ALTER TABLE "ApplicationDocument" RENAME CONSTRAINT "ApplicationDocument_application_fkey" TO "ApplicationDocument_jobApplicationId_fkey";

-- RenameForeignKey
ALTER TABLE "ApplicationDocument" RENAME CONSTRAINT "ApplicationDocument_sourceCv_fkey" TO "ApplicationDocument_sourceCandidateCvId_fkey";

-- RenameForeignKey
ALTER TABLE "ApplicationDocumentLegalHold" RENAME CONSTRAINT "ApplicationDocumentLegalHold_application_fkey" TO "ApplicationDocumentLegalHold_jobApplicationId_fkey";

-- RenameForeignKey
ALTER TABLE "ApplicationDocumentLegalHold" RENAME CONSTRAINT "ApplicationDocumentLegalHold_issuer_fkey" TO "ApplicationDocumentLegalHold_issuedByAdminUserId_fkey";

-- RenameForeignKey
ALTER TABLE "ApplicationScoringResult" RENAME CONSTRAINT "ApplicationScoringResult_ai_fkey" TO "ApplicationScoringResult_aiAssessmentId_fkey";

-- RenameForeignKey
ALTER TABLE "ApplicationScoringResult" RENAME CONSTRAINT "ApplicationScoringResult_application_fkey" TO "ApplicationScoringResult_jobApplicationId_fkey";

-- RenameForeignKey
ALTER TABLE "ApplicationScoringResult" RENAME CONSTRAINT "ApplicationScoringResult_automatic_fkey" TO "ApplicationScoringResult_automaticMatchResultId_fkey";

-- RenameForeignKey
ALTER TABLE "ApplicationScoringResult" RENAME CONSTRAINT "ApplicationScoringResult_operation_fkey" TO "ApplicationScoringResult_operationId_fkey";

-- RenameForeignKey
ALTER TABLE "CvEvidenceExcerpt" RENAME CONSTRAINT "CvEvidenceExcerpt_skill_fkey" TO "CvEvidenceExcerpt_skillEvidenceExtractionId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentParseResult" RENAME CONSTRAINT "DocumentParseResult_result_fkey" TO "DocumentParseResult_automaticMatchResultId_fkey";

-- RenameForeignKey
ALTER TABLE "JobApplication" RENAME CONSTRAINT "JobApplication_currentScoringResult_fkey" TO "JobApplication_currentScoringResultId_fkey";

-- RenameForeignKey
ALTER TABLE "ManualApplicationPriority" RENAME CONSTRAINT "ManualApplicationPriority_actor_fkey" TO "ManualApplicationPriority_setByUserId_fkey";

-- RenameForeignKey
ALTER TABLE "ManualApplicationPriority" RENAME CONSTRAINT "ManualApplicationPriority_application_fkey" TO "ManualApplicationPriority_jobApplicationId_fkey";

-- RenameForeignKey
ALTER TABLE "RankingSnapshot" RENAME CONSTRAINT "RankingSnapshot_job_fkey" TO "RankingSnapshot_jobPostingId_fkey";

-- RenameForeignKey
ALTER TABLE "RankingSnapshotRow" RENAME CONSTRAINT "RankingSnapshotRow_application_fkey" TO "RankingSnapshotRow_applicationId_fkey";

-- RenameForeignKey
ALTER TABLE "RankingSnapshotRow" RENAME CONSTRAINT "RankingSnapshotRow_snapshot_fkey" TO "RankingSnapshotRow_rankingSnapshotId_fkey";

-- RenameForeignKey
ALTER TABLE "ScoringOperation" RENAME CONSTRAINT "ScoringOperation_application_fkey" TO "ScoringOperation_jobApplicationId_fkey";

-- RenameForeignKey
ALTER TABLE "ScoringOperation" RENAME CONSTRAINT "ScoringOperation_job_fkey" TO "ScoringOperation_jobPostingId_fkey";

-- RenameForeignKey
ALTER TABLE "ScoringOperation" RENAME CONSTRAINT "ScoringOperation_requester_fkey" TO "ScoringOperation_requestedByUserId_fkey";

-- RenameForeignKey
ALTER TABLE "ScoringWorkItem" RENAME CONSTRAINT "ScoringWorkItem_application_fkey" TO "ScoringWorkItem_jobApplicationId_fkey";

-- RenameForeignKey
ALTER TABLE "ScoringWorkItem" RENAME CONSTRAINT "ScoringWorkItem_operation_fkey" TO "ScoringWorkItem_operationId_fkey";

-- RenameForeignKey
ALTER TABLE "SkillEvidenceExtraction" RENAME CONSTRAINT "SkillEvidenceExtraction_result_fkey" TO "SkillEvidenceExtraction_automaticMatchResultId_fkey";

-- RenameIndex
ALTER INDEX IF EXISTS "AiAssessment_application_computed_idx" RENAME TO "AiAssessment_jobApplicationId_computedAt_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "ApplicationDocumentLegalHold_jobApplicationId_endsAt_releasedAt" RENAME TO "ApplicationDocumentLegalHold_jobApplicationId_endsAt_releas_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "ApplicationScoringResult_application_generation_key" RENAME TO "ApplicationScoringResult_jobApplicationId_generation_key";

-- RenameIndex
ALTER INDEX IF EXISTS "ApplicationScoringResult_final_published_idx" RENAME TO "ApplicationScoringResult_finalScore_publishedAt_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "AutomaticMatchResult_application_computed_idx" RENAME TO "AutomaticMatchResult_jobApplicationId_computedAt_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "BusinessRegistryLookupSnapshot_applicant_tax_expiry_idx" RENAME TO "BusinessRegistryLookupSnapshot_applicantUserId_normalizedTa_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "BusinessRegistryLookupSnapshot_expiry_acceptance_idx" RENAME TO "BusinessRegistryLookupSnapshot_expiresAt_acceptedRequestId__idx";

-- RenameIndex
ALTER INDEX IF EXISTS "CompanyContactEmailChallenge_binding_state_idx" RENAME TO "CompanyContactEmailChallenge_applicantUserId_lookupSnapshot_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "CvEvidenceExcerpt_retention_idx" RENAME TO "CvEvidenceExcerpt_deleteAfter_deletedAt_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "DocumentParseResult_result_kind_idx" RENAME TO "DocumentParseResult_automaticMatchResultId_documentKind_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "ManualApplicationPriority_application_active_idx" RENAME TO "ManualApplicationPriority_jobApplicationId_active_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "ManualApplicationPriority_application_version_key" RENAME TO "ManualApplicationPriority_jobApplicationId_version_key";

-- RenameIndex
ALTER INDEX IF EXISTS "RankingSnapshot_job_expiry_idx" RENAME TO "RankingSnapshot_jobPostingId_expiresAt_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "RankingSnapshot_job_generation_key" RENAME TO "RankingSnapshot_jobPostingId_generation_key";

-- RenameIndex
ALTER INDEX IF EXISTS "RankingSnapshotRow_snapshot_application_key" RENAME TO "RankingSnapshotRow_rankingSnapshotId_applicationId_key";

-- RenameIndex
ALTER INDEX IF EXISTS "RankingSnapshotRow_snapshot_rank_key" RENAME TO "RankingSnapshotRow_rankingSnapshotId_rankPosition_key";

-- RenameIndex
ALTER INDEX IF EXISTS "ScoringOperation_job_state_created_idx" RENAME TO "ScoringOperation_jobPostingId_state_createdAt_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "ScoringWorkItem_operation_application_key" RENAME TO "ScoringWorkItem_operationId_jobApplicationId_key";

-- RenameIndex
ALTER INDEX IF EXISTS "ScoringWorkItem_state_next_idx" RENAME TO "ScoringWorkItem_state_nextAttemptAt_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "SkillEvidenceExtraction_result_skill_requirement_key" RENAME TO "SkillEvidenceExtraction_automaticMatchResultId_skillCanonic_key";

-- RenameIndex
ALTER INDEX IF EXISTS "VerificationNotificationEvent_emailStatus_inAppStatus_updatedAt" RENAME TO "VerificationNotificationEvent_emailStatus_inAppStatus_updat_idx";

-- RenameIndex
ALTER INDEX IF EXISTS "VerificationNotificationEvent_verificationRequestId_eventKind_i" RENAME TO "VerificationNotificationEvent_verificationRequestId_eventKi_idx";
