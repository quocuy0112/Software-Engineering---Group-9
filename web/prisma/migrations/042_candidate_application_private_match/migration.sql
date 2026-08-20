-- Candidate-private CV Match Check. This migration intentionally creates a
-- standalone persistence pipeline. There are no foreign keys to JobPosting,
-- CandidateCv, JobApplication, Company, UserAccount, or employer scoring.

CREATE TYPE "PrivateCvMatchCheckState" AS ENUM (
  'QUEUED', 'ANALYZING', 'LIMITED', 'READY', 'FAILED', 'INACCESSIBLE'
);

CREATE TYPE "PrivateCvMatchAttemptTrigger" AS ENUM ('INITIAL', 'AI_RETRY');

CREATE TYPE "PrivateCvMatchAttemptState" AS ENUM (
  'QUEUED', 'AUTOMATIC_RUNNING', 'AUTOMATIC_READY', 'AI_RUNNING',
  'READY', 'LIMITED', 'FAILED'
);

CREATE TYPE "PrivateMatchEvidenceClassification" AS ENUM (
  'SKILL', 'PROJECT', 'IMPACT', 'EXPERIENCE', 'EDUCATION', 'OTHER'
);

CREATE TABLE "PrivateCvMatchCheck" (
  "id" TEXT NOT NULL,
  "candidateUserId" VARCHAR(128) NOT NULL,
  "cvVersionId" VARCHAR(128) NOT NULL,
  "cvVersion" INTEGER NOT NULL,
  "cvDigest" CHAR(64) NOT NULL,
  "jobPostingId" VARCHAR(128) NOT NULL,
  "jdVersion" INTEGER NOT NULL,
  "jdDigest" CHAR(64) NOT NULL,
  "scoringConfigVersion" VARCHAR(64) NOT NULL,
  "creationDedupeKey" CHAR(64),
  "cvSnapshot" JSONB NOT NULL,
  "jdSnapshot" JSONB NOT NULL,
  "cvTextSnapshot" TEXT,
  "currentAttemptId" TEXT,
  "state" "PrivateCvMatchCheckState" NOT NULL DEFAULT 'QUEUED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "inaccessibleAt" TIMESTAMP(3),
  "deleteAfter" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "deleteLeaseOwner" VARCHAR(128),
  "deleteLeaseExpiresAt" TIMESTAMP(3),
  "deleteAttempts" INTEGER NOT NULL DEFAULT 0,
  "deleteFailureCode" VARCHAR(80),
  CONSTRAINT "PrivateCvMatchCheck_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrivateCvMatchCheck_deadline_check" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "PrivateCvMatchCheck_delete_window_check" CHECK (
    "inaccessibleAt" IS NULL OR
    ("deleteAfter" IS NOT NULL AND "deleteAfter" <= "inaccessibleAt" + INTERVAL '30 days')
  ),
  CONSTRAINT "PrivateCvMatchCheck_delete_state_check" CHECK (
    ("inaccessibleAt" IS NULL AND "state" <> 'INACCESSIBLE') OR
    ("inaccessibleAt" IS NOT NULL AND "state" = 'INACCESSIBLE')
  )
);

CREATE TABLE "PrivateCvMatchAttempt" (
  "id" TEXT NOT NULL,
  "checkId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "trigger" "PrivateCvMatchAttemptTrigger" NOT NULL,
  "state" "PrivateCvMatchAttemptState" NOT NULL DEFAULT 'QUEUED',
  "deterministicResultId" TEXT,
  "aiResultId" TEXT,
  "hybridScore" DECIMAL(5,1),
  "matchBand" VARCHAR(32),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failureCode" VARCHAR(80),
  "provider" VARCHAR(100),
  "model" VARCHAR(200),
  "promptVersion" VARCHAR(100),
  "inputPolicyVersion" VARCHAR(100),
  "scoringPolicyVersion" VARCHAR(64) NOT NULL,
  "leaseOwner" VARCHAR(128),
  "leaseExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivateCvMatchAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrivateCvMatchAttempt_score_check" CHECK (
    "hybridScore" IS NULL OR ("hybridScore" >= 0 AND "hybridScore" <= 100)
  ),
  CONSTRAINT "PrivateCvMatchAttempt_publication_check" CHECK (
    ("state" IN ('READY', 'LIMITED')) OR
    ("hybridScore" IS NULL AND "matchBand" IS NULL)
  )
);

CREATE TABLE "PrivateAutomaticMatchResult" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "score" DECIMAL(5,2) NOT NULL,
  "weight" DECIMAL(3,2) NOT NULL DEFAULT 0.60,
  "weightedContribution" DECIMAL(5,2) NOT NULL,
  "matchedRequirements" JSONB NOT NULL,
  "gaps" JSONB NOT NULL,
  "requiredExperience" DECIMAL(5,2),
  "detectedExperience" DECIMAL(5,2),
  "evidenceCoverage" DECIMAL(5,2) NOT NULL,
  "parserProvenance" JSONB NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL,
  "mayBeIncomplete" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "PrivateAutomaticMatchResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrivateAutomaticMatchResult_score_check" CHECK ("score" >= 0 AND "score" <= 100),
  CONSTRAINT "PrivateAutomaticMatchResult_weight_check" CHECK ("weight" = 0.60),
  CONSTRAINT "PrivateAutomaticMatchResult_coverage_check" CHECK ("evidenceCoverage" >= 0 AND "evidenceCoverage" <= 100)
);

CREATE TABLE "PrivateAiEvaluationResult" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "score" DECIMAL(5,2) NOT NULL,
  "weight" DECIMAL(3,2) NOT NULL DEFAULT 0.40,
  "weightedContribution" DECIMAL(5,2) NOT NULL,
  "summary" TEXT NOT NULL,
  "strengths" JSONB NOT NULL,
  "mainGap" VARCHAR(1000),
  "actions" JSONB NOT NULL,
  "evidenceConfidence" INTEGER NOT NULL,
  "evidenceLevel" VARCHAR(16) NOT NULL,
  "provider" VARCHAR(100) NOT NULL,
  "model" VARCHAR(200) NOT NULL,
  "promptVersion" VARCHAR(100) NOT NULL,
  "policyVersion" VARCHAR(100) NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivateAiEvaluationResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrivateAiEvaluationResult_score_check" CHECK ("score" >= 0 AND "score" <= 100),
  CONSTRAINT "PrivateAiEvaluationResult_weight_check" CHECK ("weight" = 0.40),
  CONSTRAINT "PrivateAiEvaluationResult_confidence_check" CHECK ("evidenceConfidence" >= 0 AND "evidenceConfidence" <= 100),
  CONSTRAINT "PrivateAiEvaluationResult_duration_check" CHECK ("durationMs" >= 0)
);

CREATE TABLE "PrivateMatchEvidence" (
  "id" TEXT NOT NULL,
  "automaticResultId" TEXT NOT NULL,
  "criterionId" VARCHAR(128) NOT NULL,
  "criterionVersion" VARCHAR(64) NOT NULL,
  "classification" "PrivateMatchEvidenceClassification" NOT NULL,
  "quote" VARCHAR(1000) NOT NULL,
  "location" JSONB NOT NULL,
  "confidenceMetadata" JSONB NOT NULL,
  "exclusionFlags" JSONB NOT NULL,
  CONSTRAINT "PrivateMatchEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivateCvMatchCommandReceipt" (
  "id" TEXT NOT NULL,
  "candidateUserId" VARCHAR(128) NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "commandKind" VARCHAR(32) NOT NULL,
  "requestDigest" CHAR(64) NOT NULL,
  "checkId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivateCvMatchCommandReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivateCvMatchCheck_creationDedupeKey_key"
  ON "PrivateCvMatchCheck" ("creationDedupeKey");
CREATE UNIQUE INDEX "PrivateCvMatchCheck_currentAttemptId_key"
  ON "PrivateCvMatchCheck" ("currentAttemptId");
CREATE INDEX "PrivateCvMatchCheck_candidate_created_idx"
  ON "PrivateCvMatchCheck" ("candidateUserId", "createdAt" DESC, "id" DESC);
CREATE INDEX "PrivateCvMatchCheck_expiry_idx"
  ON "PrivateCvMatchCheck" ("expiresAt", "inaccessibleAt");
CREATE INDEX "PrivateCvMatchCheck_cleanup_idx"
  ON "PrivateCvMatchCheck" ("deleteAfter", "deletedAt");

CREATE UNIQUE INDEX "PrivateCvMatchAttempt_check_attempt_key"
  ON "PrivateCvMatchAttempt" ("checkId", "attemptNumber");
CREATE UNIQUE INDEX "PrivateCvMatchAttempt_deterministicResultId_key"
  ON "PrivateCvMatchAttempt" ("deterministicResultId");
CREATE UNIQUE INDEX "PrivateCvMatchAttempt_aiResultId_key"
  ON "PrivateCvMatchAttempt" ("aiResultId");
CREATE INDEX "PrivateCvMatchAttempt_work_idx"
  ON "PrivateCvMatchAttempt" ("state", "leaseExpiresAt", "id");
CREATE INDEX "PrivateCvMatchAttempt_check_created_idx"
  ON "PrivateCvMatchAttempt" ("checkId", "createdAt", "id");

CREATE UNIQUE INDEX "PrivateAutomaticMatchResult_attemptId_key"
  ON "PrivateAutomaticMatchResult" ("attemptId");
CREATE INDEX "PrivateAutomaticMatchResult_calculated_idx"
  ON "PrivateAutomaticMatchResult" ("calculatedAt", "id");
CREATE UNIQUE INDEX "PrivateAiEvaluationResult_attemptId_key"
  ON "PrivateAiEvaluationResult" ("attemptId");
CREATE INDEX "PrivateAiEvaluationResult_completed_idx"
  ON "PrivateAiEvaluationResult" ("completedAt", "id");
CREATE INDEX "PrivateMatchEvidence_result_idx"
  ON "PrivateMatchEvidence" ("automaticResultId", "classification", "id");
CREATE UNIQUE INDEX "PrivateCvMatchCommandReceipt_actor_key"
  ON "PrivateCvMatchCommandReceipt" ("candidateUserId", "idempotencyKey");
CREATE INDEX "PrivateCvMatchCommandReceipt_check_idx"
  ON "PrivateCvMatchCommandReceipt" ("checkId", "createdAt", "id");

ALTER TABLE "PrivateCvMatchAttempt"
  ADD CONSTRAINT "PrivateCvMatchAttempt_checkId_fkey"
  FOREIGN KEY ("checkId") REFERENCES "PrivateCvMatchCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateAutomaticMatchResult"
  ADD CONSTRAINT "PrivateAutomaticMatchResult_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "PrivateCvMatchAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateAiEvaluationResult"
  ADD CONSTRAINT "PrivateAiEvaluationResult_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "PrivateCvMatchAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateCvMatchAttempt"
  ADD CONSTRAINT "PrivateCvMatchAttempt_deterministicResultId_fkey"
  FOREIGN KEY ("deterministicResultId") REFERENCES "PrivateAutomaticMatchResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrivateCvMatchAttempt"
  ADD CONSTRAINT "PrivateCvMatchAttempt_aiResultId_fkey"
  FOREIGN KEY ("aiResultId") REFERENCES "PrivateAiEvaluationResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrivateMatchEvidence"
  ADD CONSTRAINT "PrivateMatchEvidence_automaticResultId_fkey"
  FOREIGN KEY ("automaticResultId") REFERENCES "PrivateAutomaticMatchResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateCvMatchCommandReceipt"
  ADD CONSTRAINT "PrivateCvMatchCommandReceipt_checkId_fkey"
  FOREIGN KEY ("checkId") REFERENCES "PrivateCvMatchCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrivateCvMatchCheck"
  ADD CONSTRAINT "PrivateCvMatchCheck_currentAttemptId_fkey"
  FOREIGN KEY ("currentAttemptId") REFERENCES "PrivateCvMatchAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "enforce_private_current_attempt"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  attempt_check_id TEXT;
  attempt_state TEXT;
BEGIN
  IF NEW.currentAttemptId IS NULL THEN
    IF NEW.state IN ('READY', 'LIMITED') THEN
      RAISE EXCEPTION 'private check terminal state requires a current attempt';
    END IF;
    RETURN NEW;
  END IF;

  SELECT "checkId", "state"::text
    INTO attempt_check_id, attempt_state
    FROM "PrivateCvMatchAttempt"
   WHERE "id" = NEW.currentAttemptId;

  IF attempt_check_id IS DISTINCT FROM NEW.id
     OR attempt_state NOT IN ('READY', 'LIMITED') THEN
    RAISE EXCEPTION 'private current attempt must belong to its check and be publishable';
  END IF;
  IF NEW.state = 'READY' AND attempt_state <> 'READY' THEN
    RAISE EXCEPTION 'ready private check requires a ready attempt';
  END IF;
  IF NEW.state = 'LIMITED' AND attempt_state <> 'LIMITED' THEN
    RAISE EXCEPTION 'limited private check requires a limited attempt';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "PrivateCvMatchCheck_current_attempt_trigger"
BEFORE INSERT OR UPDATE OF "currentAttemptId", "state"
ON "PrivateCvMatchCheck"
FOR EACH ROW EXECUTE FUNCTION "enforce_private_current_attempt"();

CREATE OR REPLACE FUNCTION "enforce_private_published_attempt"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.state NOT IN ('READY', 'LIMITED')
     AND EXISTS (
       SELECT 1 FROM "PrivateCvMatchCheck"
        WHERE "currentAttemptId" = NEW.id
     ) THEN
    RAISE EXCEPTION 'current private attempt must remain publishable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "PrivateCvMatchAttempt_publication_trigger"
BEFORE UPDATE OF "state"
ON "PrivateCvMatchAttempt"
FOR EACH ROW EXECUTE FUNCTION "enforce_private_published_attempt"();

CREATE OR REPLACE FUNCTION "prevent_private_result_update"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'private match results are immutable';
END;
$$;

CREATE TRIGGER "PrivateAutomaticMatchResult_immutable_trigger"
BEFORE UPDATE ON "PrivateAutomaticMatchResult"
FOR EACH ROW EXECUTE FUNCTION "prevent_private_result_update"();

CREATE TRIGGER "PrivateAiEvaluationResult_immutable_trigger"
BEFORE UPDATE ON "PrivateAiEvaluationResult"
FOR EACH ROW EXECUTE FUNCTION "prevent_private_result_update"();

CREATE TRIGGER "PrivateMatchEvidence_immutable_trigger"
BEFORE UPDATE ON "PrivateMatchEvidence"
FOR EACH ROW EXECUTE FUNCTION "prevent_private_result_update"();
