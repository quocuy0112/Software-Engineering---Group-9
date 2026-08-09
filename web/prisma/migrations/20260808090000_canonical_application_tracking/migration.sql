-- Canonical recruitment tracking is additive and forward-only. JobApplication
-- remains the source of truth while append-only events provide history and
-- optimistic versioning protects recruiter transitions.

CREATE TYPE "CompanyMembershipRole" AS ENUM ('OWNER', 'HR_MANAGER', 'RECRUITER', 'HIRING_MANAGER');
CREATE TYPE "CompanyMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "ApplicationStageActorType" AS ENUM ('CANDIDATE', 'RECRUITER', 'SYSTEM_MIGRATION');
CREATE TYPE "ApplicationScoringStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TYPE "RecruitmentNotificationKind" ADD VALUE IF NOT EXISTS 'APPLICATION_STAGE_CHANGED';
ALTER TYPE "EmailKind" ADD VALUE IF NOT EXISTS 'APPLICATION_STAGE_CHANGED';

ALTER TABLE "JobApplication"
  ADD COLUMN "stageVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lastStageChangedAt" TIMESTAMP(3),
  ADD COLUMN "scoringStatus" "ApplicationScoringStatus" NOT NULL DEFAULT 'NOT_REQUESTED';

UPDATE "JobApplication"
SET "lastStageChangedAt" = "submittedAt"
WHERE "lastStageChangedAt" IS NULL;

UPDATE "JobApplication"
SET "scoringStatus" = CASE
  WHEN "aiAnalysisConsent" = false THEN 'NOT_REQUESTED'::"ApplicationScoringStatus"
  WHEN "aiMatchScore" IS NOT NULL THEN 'COMPLETED'::"ApplicationScoringStatus"
  ELSE 'PENDING'::"ApplicationScoringStatus"
END;

UPDATE "JobApplication"
SET "aiMatchScore" = NULL
WHERE "aiAnalysisConsent" = false;

ALTER TABLE "JobApplication"
  ALTER COLUMN "lastStageChangedAt" SET NOT NULL,
  ALTER COLUMN "lastStageChangedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ADD CONSTRAINT "JobApplication_stage_version_check" CHECK ("stageVersion" > 0),
  ADD CONSTRAINT "JobApplication_scoring_status_check" CHECK (
    ("aiMatchScore" IS NULL OR "aiMatchScore" BETWEEN 0 AND 100) AND
    (
      ("scoringStatus" = 'NOT_REQUESTED' AND "aiAnalysisConsent" = false AND "aiMatchScore" IS NULL) OR
      ("scoringStatus" IN ('PENDING', 'PROCESSING', 'FAILED') AND "aiAnalysisConsent" = true AND "aiMatchScore" IS NULL) OR
      ("scoringStatus" = 'COMPLETED' AND "aiAnalysisConsent" = true AND "aiMatchScore" IS NOT NULL)
    )
  );

CREATE TABLE "CompanyMembership" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "CompanyMembershipRole" NOT NULL,
  "status" "CompanyMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationStageEvent" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "fromStage" "ApplicationStage",
  "toStage" "ApplicationStage" NOT NULL,
  "actorUserId" TEXT,
  "actorType" "ApplicationStageActorType" NOT NULL,
  "reasonCode" TEXT,
  "candidateVisibleReason" TEXT,
  "candidateVisible" BOOLEAN NOT NULL DEFAULT true,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "applicationVersion" INTEGER NOT NULL,
  "metadata" JSONB,
  CONSTRAINT "ApplicationStageEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicationStageEvent_values_check" CHECK (
    "applicationVersion" > 0 AND
    ("reasonCode" IS NULL OR char_length("reasonCode") BETWEEN 1 AND 80) AND
    ("candidateVisibleReason" IS NULL OR char_length("candidateVisibleReason") BETWEEN 1 AND 500) AND
    ("metadata" IS NULL OR (jsonb_typeof("metadata") = 'object' AND octet_length("metadata"::text) <= 4096))
  )
);

INSERT INTO "ApplicationStageEvent" (
  "id",
  "applicationId",
  "fromStage",
  "toStage",
  "actorUserId",
  "actorType",
  "candidateVisible",
  "occurredAt",
  "applicationVersion",
  "metadata"
)
SELECT
  'migration-' || md5("id"),
  "id",
  NULL,
  "stage",
  NULL,
  'SYSTEM_MIGRATION',
  true,
  "submittedAt",
  1,
  jsonb_build_object('v', 1, 'source', 'canonical-application-tracking-backfill')
FROM "JobApplication"
ON CONFLICT DO NOTHING;

DROP INDEX IF EXISTS "RecruitmentNotificationWork_applicationId_audience_kind_key";

CREATE UNIQUE INDEX "CompanyMembership_companyId_userId_key"
  ON "CompanyMembership"("companyId", "userId");
CREATE INDEX "CompanyMembership_userId_status_idx"
  ON "CompanyMembership"("userId", "status");
CREATE INDEX "CompanyMembership_companyId_role_status_idx"
  ON "CompanyMembership"("companyId", "role", "status");
CREATE UNIQUE INDEX "ApplicationStageEvent_applicationId_applicationVersion_key"
  ON "ApplicationStageEvent"("applicationId", "applicationVersion");
CREATE INDEX "ApplicationStageEvent_applicationId_occurredAt_id_idx"
  ON "ApplicationStageEvent"("applicationId", "occurredAt", "id");
CREATE INDEX "ApplicationStageEvent_actorUserId_occurredAt_idx"
  ON "ApplicationStageEvent"("actorUserId", "occurredAt");
ALTER TABLE "CompanyMembership"
  ADD CONSTRAINT "CompanyMembership_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyMembership"
  ADD CONSTRAINT "CompanyMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationStageEvent"
  ADD CONSTRAINT "ApplicationStageEvent_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
