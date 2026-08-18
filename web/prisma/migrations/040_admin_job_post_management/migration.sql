CREATE TYPE "JobPostVisibilityState" AS ENUM ('PUBLISHED', 'HIDDEN', 'ARCHIVED');
CREATE TYPE "JobPostApplicationState" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "JobPostRevisionRequestState" AS ENUM ('OPEN', 'SATISFIED', 'CANCELLED');
CREATE TYPE "JobPostFeatureState" AS ENUM ('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "JobPostEnforcementType" AS ENUM ('HIDE_JOB', 'CLOSE_APPLICATIONS', 'REQUEST_CHANGES', 'SOFT_DELETE_JOB', 'SUSPEND_COMPANY', 'SUSPEND_RECRUITER');
CREATE TYPE "PlatformAdministratorScope" AS ENUM ('JOB_POST_MODERATE', 'JOB_POST_FEATURE', 'JOB_POST_ENFORCE');

ALTER TABLE "JobPostReviewAggregate"
  ADD COLUMN "visibilityState" "JobPostVisibilityState" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "applicationState" "JobPostApplicationState" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "hiddenAt" TIMESTAMP(3), ADD COLUMN "hiddenByUserId" TEXT, ADD COLUMN "hiddenReason" VARCHAR(1000),
  ADD COLUMN "archivedAt" TIMESTAMP(3), ADD COLUMN "archivedByUserId" TEXT,
  ADD COLUMN "applicationClosedAt" TIMESTAMP(3), ADD COLUMN "applicationClosedByUserId" TEXT,
  ADD COLUMN "softDeletedAt" TIMESTAMP(3), ADD COLUMN "softDeletedByUserId" TEXT, ADD COLUMN "softDeleteReason" VARCHAR(1000),
  ADD COLUMN "operationalVersion" INTEGER NOT NULL DEFAULT 1;

UPDATE "JobPostReviewAggregate" r
SET "visibilityState" = CASE WHEN j."status" = 'EXPIRED' THEN 'ARCHIVED'::"JobPostVisibilityState" WHEN j."status" = 'REMOVED' THEN 'HIDDEN'::"JobPostVisibilityState" ELSE 'PUBLISHED'::"JobPostVisibilityState" END,
    "applicationState" = CASE WHEN j."status" = 'CLOSED' THEN 'CLOSED'::"JobPostApplicationState" ELSE 'OPEN'::"JobPostApplicationState" END
FROM "JobPosting" j WHERE j."id" = r."publicJobPostingId";

CREATE TABLE "PlatformAdministratorGrantScopeAssignment" (
  "grantId" TEXT NOT NULL, "scope" "PlatformAdministratorScope" NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAdministratorGrantScopeAssignment_pkey" PRIMARY KEY ("grantId", "scope"),
  CONSTRAINT "PlatformAdministratorGrantScopeAssignment_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "PlatformAdministratorGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PlatformAdministratorGrantScopeAssignment_scope_grantId_idx" ON "PlatformAdministratorGrantScopeAssignment"("scope", "grantId");
INSERT INTO "PlatformAdministratorGrantScopeAssignment" ("grantId", "scope") SELECT "id", 'JOB_POST_MODERATE'::"PlatformAdministratorScope" FROM "PlatformAdministratorGrant" WHERE "state" = 'ACTIVE' ON CONFLICT DO NOTHING;

CREATE TABLE "JobPostRevisionRequest" (
  "id" TEXT NOT NULL, "aggregateId" TEXT NOT NULL, "liveVersionId" TEXT NOT NULL, "requestedByAdminUserId" TEXT NOT NULL, "publicExplanation" VARCHAR(1000) NOT NULL, "hideImmediately" BOOLEAN NOT NULL DEFAULT false, "state" "JobPostRevisionRequestState" NOT NULL DEFAULT 'OPEN', "submittedRevisionId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "satisfiedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "JobPostRevisionRequest_pkey" PRIMARY KEY ("id"), CONSTRAINT "JobPostRevisionRequest_submittedRevisionId_key" UNIQUE ("submittedRevisionId"), CONSTRAINT "JobPostRevisionRequest_aggregateId_fkey" FOREIGN KEY ("aggregateId") REFERENCES "JobPostReviewAggregate"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "JobPostRevisionRequest_aggregateId_state_createdAt_idx" ON "JobPostRevisionRequest"("aggregateId", "state", "createdAt");
CREATE UNIQUE INDEX "JobPostRevisionRequest_one_open_per_aggregate" ON "JobPostRevisionRequest"("aggregateId") WHERE "state" = 'OPEN';

CREATE TABLE "JobPostFeaturedPlacement" ("id" TEXT NOT NULL, "aggregateId" TEXT NOT NULL, "placement" VARCHAR(64) NOT NULL, "priority" INTEGER NOT NULL, "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL, "state" "JobPostFeatureState" NOT NULL DEFAULT 'SCHEDULED', "reason" VARCHAR(1000) NOT NULL, "createdByAdminUserId" TEXT NOT NULL, "cancelledByAdminUserId" TEXT, "cancelledAt" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobPostFeaturedPlacement_pkey" PRIMARY KEY ("id"), CONSTRAINT "JobPostFeaturedPlacement_aggregateId_fkey" FOREIGN KEY ("aggregateId") REFERENCES "JobPostReviewAggregate"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE INDEX "JobPostFeaturedPlacement_placement_startsAt_endsAt_idx" ON "JobPostFeaturedPlacement"("placement", "startsAt", "endsAt");
CREATE INDEX "JobPostFeaturedPlacement_aggregateId_state_startsAt_idx" ON "JobPostFeaturedPlacement"("aggregateId", "state", "startsAt");

CREATE TABLE "JobPostEnforcementAction" ("id" TEXT NOT NULL, "correlationId" VARCHAR(128) NOT NULL, "type" "JobPostEnforcementType" NOT NULL, "actorAdminUserId" TEXT NOT NULL, "actorSessionId" TEXT, "reason" VARCHAR(1000) NOT NULL, "publicExplanation" VARCHAR(1000), "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "JobPostEnforcementAction_pkey" PRIMARY KEY ("id"), CONSTRAINT "JobPostEnforcementAction_correlationId_key" UNIQUE ("correlationId"));
CREATE INDEX "JobPostEnforcementAction_actorAdminUserId_occurredAt_idx" ON "JobPostEnforcementAction"("actorAdminUserId", "occurredAt");
CREATE TABLE "JobPostEnforcementTarget" ("id" TEXT NOT NULL, "enforcementActionId" TEXT NOT NULL, "aggregateId" TEXT, "targetType" VARCHAR(32) NOT NULL, "targetReference" VARCHAR(128) NOT NULL, "priorState" JSONB, "resultingState" JSONB, CONSTRAINT "JobPostEnforcementTarget_pkey" PRIMARY KEY ("id"), CONSTRAINT "JobPostEnforcementTarget_enforcementActionId_fkey" FOREIGN KEY ("enforcementActionId") REFERENCES "JobPostEnforcementAction"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "JobPostEnforcementTarget_aggregateId_fkey" FOREIGN KEY ("aggregateId") REFERENCES "JobPostReviewAggregate"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE INDEX "JobPostEnforcementTarget_aggregateId_idx" ON "JobPostEnforcementTarget"("aggregateId");
CREATE INDEX "JobPostEnforcementTarget_targetType_targetReference_idx" ON "JobPostEnforcementTarget"("targetType", "targetReference");
CREATE TABLE "ModerationReportEnforcementLink" ("moderationReportId" TEXT NOT NULL, "enforcementActionId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ModerationReportEnforcementLink_pkey" PRIMARY KEY ("moderationReportId", "enforcementActionId"), CONSTRAINT "ModerationReportEnforcementLink_moderationReportId_fkey" FOREIGN KEY ("moderationReportId") REFERENCES "ModerationReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT "ModerationReportEnforcementLink_enforcementActionId_fkey" FOREIGN KEY ("enforcementActionId") REFERENCES "JobPostEnforcementAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE INDEX "ModerationReportEnforcementLink_enforcementActionId_idx" ON "ModerationReportEnforcementLink"("enforcementActionId");
CREATE TABLE "JobPostOperationalHistory" ("id" TEXT NOT NULL, "aggregateId" TEXT NOT NULL, "action" VARCHAR(64) NOT NULL, "actorUserId" TEXT, "correlationId" VARCHAR(128) NOT NULL, "priorState" JSONB, "resultingState" JSONB, "reason" VARCHAR(1000), "version" INTEGER NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "JobPostOperationalHistory_pkey" PRIMARY KEY ("id"), CONSTRAINT "JobPostOperationalHistory_aggregateId_fkey" FOREIGN KEY ("aggregateId") REFERENCES "JobPostReviewAggregate"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE INDEX "JobPostOperationalHistory_aggregateId_occurredAt_id_idx" ON "JobPostOperationalHistory"("aggregateId", "occurredAt", "id");
