-- Candidate Application Workflow: resumable drafts, technical intake, safe
-- public updates, application-local notification preferences, and withdrawal.

CREATE TYPE "ApplicationWithdrawalOutcome" AS ENUM ('CANDIDATE_WITHDRAWN');
CREATE TYPE "ApplicationIntakeState" AS ENUM (
  'RECEIVED',
  'CHECKING_FILES',
  'SENT_TO_RECRUITER',
  'ATTENTION_REQUIRED'
);
CREATE TYPE "ApplicationPublicUpdateKind" AS ENUM (
  'SUBMITTED',
  'UNDER_REVIEW',
  'INTERVIEW',
  'OUTCOME',
  'WITHDRAWN',
  'TECHNICAL_UPDATE'
);
CREATE TYPE "ApplicationPublicStage" AS ENUM (
  'APPLICATION_SUBMITTED',
  'UNDER_REVIEW',
  'INTERVIEW',
  'OUTCOME'
);
CREATE TYPE "ApplicationPublicOutcome" AS ENUM (
  'OFFERED',
  'HIRED',
  'OFFER_DECLINED',
  'REJECTED',
  'WITHDRAWN'
);

ALTER TABLE "JobApplication"
  ADD COLUMN "submissionMessage" TEXT,
  ADD COLUMN "withdrawalOutcome" "ApplicationWithdrawalOutcome",
  ADD COLUMN "withdrawnAt" TIMESTAMP(3),
  ADD COLUMN "withdrawnByUserId" TEXT,
  ADD COLUMN "withdrawalVersion" INTEGER,
  ADD COLUMN "activeProcessingStoppedAt" TIMESTAMP(3);

ALTER TABLE "JobApplication"
  ADD CONSTRAINT "JobApplication_withdrawal_fields_check" CHECK (
    ("withdrawalOutcome" IS NULL AND "withdrawnAt" IS NULL AND "withdrawnByUserId" IS NULL AND "withdrawalVersion" IS NULL)
    OR
    ("withdrawalOutcome" IS NOT NULL AND "withdrawnAt" IS NOT NULL AND "withdrawnByUserId" IS NOT NULL AND "withdrawalVersion" IS NOT NULL)
  );

CREATE TABLE "CandidateApplicationDraft" (
  "id" TEXT NOT NULL,
  "candidateUserId" TEXT NOT NULL,
  "jobPostingId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "personalInfoDraft" JSONB NOT NULL,
  "selectedCvId" TEXT,
  "coverLetterDraft" JSONB,
  "messageDraft" TEXT,
  "confirmationAccepted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateApplicationDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CandidateApplicationDraft_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "CandidateApplicationDraft_expiry_check" CHECK ("expiresAt" > "updatedAt")
);

CREATE UNIQUE INDEX "CandidateApplicationDraft_candidateUserId_jobPostingId_key"
  ON "CandidateApplicationDraft" ("candidateUserId", "jobPostingId");
CREATE INDEX "CandidateApplicationDraft_expiresAt_id_idx"
  ON "CandidateApplicationDraft" ("expiresAt", "id");
CREATE INDEX "CandidateApplicationDraft_candidateUserId_updatedAt_idx"
  ON "CandidateApplicationDraft" ("candidateUserId", "updatedAt" DESC);

CREATE TABLE "ApplicationIntake" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "state" "ApplicationIntakeState" NOT NULL DEFAULT 'RECEIVED',
  "progressPercent" INTEGER NOT NULL DEFAULT 0,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkingStartedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failureCode" VARCHAR(80),
  "leaseOwner" VARCHAR(128),
  "leaseExpiresAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationIntake_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicationIntake_progress_check" CHECK ("progressPercent" BETWEEN 0 AND 100),
  CONSTRAINT "ApplicationIntake_version_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "ApplicationIntake_applicationId_key"
  ON "ApplicationIntake" ("applicationId");
CREATE INDEX "ApplicationIntake_state_leaseExpiresAt_updatedAt_idx"
  ON "ApplicationIntake" ("state", "leaseExpiresAt", "updatedAt");
CREATE INDEX "ApplicationIntake_receivedAt_id_idx"
  ON "ApplicationIntake" ("receivedAt", "id");

CREATE TABLE "ApplicationPublicUpdate" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "kind" "ApplicationPublicUpdateKind" NOT NULL,
  "publicStage" "ApplicationPublicStage",
  "publicOutcome" "ApplicationPublicOutcome",
  "title" VARCHAR(160) NOT NULL,
  "variables" JSONB,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deduplicationKey" VARCHAR(255) NOT NULL,
  "sourceEventReference" VARCHAR(128),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationPublicUpdate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApplicationPublicUpdate_deduplicationKey_key"
  ON "ApplicationPublicUpdate" ("deduplicationKey");
CREATE INDEX "ApplicationPublicUpdate_applicationId_effectiveAt_id_idx"
  ON "ApplicationPublicUpdate" ("applicationId", "effectiveAt" DESC, "id" DESC);

CREATE TABLE "ApplicationNotificationPreference" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationNotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicationNotificationPreference_version_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "ApplicationNotificationPreference_applicationId_key"
  ON "ApplicationNotificationPreference" ("applicationId");

ALTER TABLE "CandidateApplicationDraft"
  ADD CONSTRAINT "CandidateApplicationDraft_candidateUserId_fkey"
  FOREIGN KEY ("candidateUserId") REFERENCES "CandidateIdentity"("userId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CandidateApplicationDraft_jobPostingId_fkey"
  FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CandidateApplicationDraft_selectedCvId_fkey"
  FOREIGN KEY ("selectedCvId") REFERENCES "CandidateCv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApplicationIntake"
  ADD CONSTRAINT "ApplicationIntake_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationPublicUpdate"
  ADD CONSTRAINT "ApplicationPublicUpdate_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationNotificationPreference"
  ADD CONSTRAINT "ApplicationNotificationPreference_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing submitted applications are already past intake. Backfill only the
-- safe technical/public projections; no drafts or withdrawal outcomes are
-- fabricated.
INSERT INTO "ApplicationIntake" (
  "id", "applicationId", "state", "progressPercent", "receivedAt",
  "checkingStartedAt", "sentAt", "version", "createdAt", "updatedAt"
)
SELECT
  'application-intake-' || application."id",
  application."id",
  'SENT_TO_RECRUITER'::"ApplicationIntakeState",
  100,
  application."submittedAt",
  application."submittedAt",
  application."submittedAt",
  1,
  application."submittedAt",
  application."updatedAt"
FROM "JobApplication" application
ON CONFLICT ("applicationId") DO NOTHING;

INSERT INTO "ApplicationNotificationPreference" (
  "id", "applicationId", "emailEnabled", "inAppEnabled", "version",
  "createdAt", "updatedAt"
)
SELECT
  'application-preference-' || application."id",
  application."id",
  COALESCE(preferences."applicationUpdatesEmail", true),
  true,
  1,
  application."submittedAt",
  application."updatedAt"
FROM "JobApplication" application
LEFT JOIN "AccountPreferences" preferences
  ON preferences."userId" = application."candidateUserId"
ON CONFLICT ("applicationId") DO NOTHING;

INSERT INTO "ApplicationPublicUpdate" (
  "id", "applicationId", "kind", "publicStage", "title",
  "effectiveAt", "deduplicationKey", "sourceEventReference", "createdAt"
)
SELECT
  'application-update-' || application."id" || '-submitted',
  application."id",
  'SUBMITTED'::"ApplicationPublicUpdateKind",
  'APPLICATION_SUBMITTED'::"ApplicationPublicStage",
  'Application submitted',
  application."submittedAt",
  'application:' || application."id" || ':public:submitted',
  stage_event."id",
  application."submittedAt"
FROM "JobApplication" application
LEFT JOIN LATERAL (
  SELECT event."id"
  FROM "ApplicationStageEvent" event
  WHERE event."applicationId" = application."id"
    AND event."toStage" = 'APPLIED'::"ApplicationStage"
  ORDER BY event."occurredAt" ASC, event."id" ASC
  LIMIT 1
) stage_event ON true
ON CONFLICT ("deduplicationKey") DO NOTHING;
