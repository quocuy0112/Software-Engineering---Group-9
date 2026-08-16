ALTER TYPE "InAppNotificationContextType" ADD VALUE IF NOT EXISTS 'JOB_POST_REVIEW';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'JOB_POST_REVIEW_REQUESTED_ADMIN';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'JOB_POST_APPROVED';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'JOB_POST_REJECTED';

CREATE TYPE "JobPostReviewState" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "JobPostReviewReasonCode" AS ENUM (
  'INCOMPLETE_OR_UNCLEAR', 'MISLEADING_CONTENT',
  'COMPENSATION_OR_LOCATION_UNCLEAR', 'DISCRIMINATORY_OR_PROHIBITED',
  'COMPANY_OR_ROLE_MISMATCH', 'DUPLICATE_OR_SPAM',
  'EXPIRED_OR_INVALID_DEADLINE', 'POLICY_OR_LEGAL_RISK',
  'OTHER_ACTION_REQUIRED'
);
CREATE TYPE "JobPostReviewHistoryAction" AS ENUM (
  'SUBMITTED', 'CLAIMED', 'REASSIGNED', 'APPROVED', 'REJECTED',
  'RESUBMITTED', 'LEGACY_BASELINE_IMPORTED', 'CLOSED'
);

CREATE TABLE "JobPostReviewAggregate" (
  "id" TEXT NOT NULL,
  "jobId" VARCHAR(128) NOT NULL,
  "companyId" TEXT NOT NULL,
  "latestSequence" INTEGER NOT NULL DEFAULT 1,
  "pendingVersionId" TEXT,
  "approvedVersionId" TEXT,
  "publicJobPostingId" TEXT,
  "closedAt" TIMESTAMP(3),
  "closedByUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "adoptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobPostReviewAggregate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobPostReviewAggregate_latest_sequence_check" CHECK ("latestSequence" >= 1),
  CONSTRAINT "JobPostReviewAggregate_version_check" CHECK ("version" >= 1),
  CONSTRAINT "JobPostReviewAggregate_closure_pair_check"
    CHECK (("closedAt" IS NULL) = ("closedByUserId" IS NULL))
);

CREATE TABLE "JobPostReviewVersion" (
  "id" TEXT NOT NULL,
  "reviewAggregateId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "snapshotSchemaVersion" VARCHAR(32) NOT NULL,
  "snapshotSha256" CHAR(64) NOT NULL,
  "state" "JobPostReviewState" NOT NULL DEFAULT 'PENDING_REVIEW',
  "submittedByUserId" TEXT,
  "submittedMembershipId" TEXT,
  "submissionIdempotencyKey" VARCHAR(128),
  "submissionRequestHash" CHAR(64),
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedAdminUserId" TEXT,
  "assignedAt" TIMESTAMP(3),
  "decidedByAdminUserId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "reasonCode" "JobPostReviewReasonCode",
  "publicExplanation" VARCHAR(1000),
  "decisionCorrelationId" VARCHAR(128),
  "importedBaseline" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobPostReviewVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobPostReviewVersion_sequence_check" CHECK ("sequence" >= 1),
  CONSTRAINT "JobPostReviewVersion_snapshot_sha256_check" CHECK ("snapshotSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "JobPostReviewVersion_submission_hash_check" CHECK ("submissionRequestHash" IS NULL OR "submissionRequestHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "JobPostReviewVersion_assignment_pair_check" CHECK (("assignedAdminUserId" IS NULL) = ("assignedAt" IS NULL)),
  CONSTRAINT "JobPostReviewVersion_submission_pair_check" CHECK (
    "importedBaseline" OR
    ("submittedByUserId" IS NOT NULL AND "submittedMembershipId" IS NOT NULL AND
     length("submissionIdempotencyKey") BETWEEN 16 AND 128 AND "submissionRequestHash" IS NOT NULL)
  ),
  CONSTRAINT "JobPostReviewVersion_state_fields_check" CHECK (
    ("state" = 'PENDING_REVIEW' AND "decidedByAdminUserId" IS NULL AND "decidedAt" IS NULL AND "publishedAt" IS NULL AND "reasonCode" IS NULL AND "publicExplanation" IS NULL) OR
    ("state" = 'APPROVED' AND "decidedAt" IS NOT NULL AND "publishedAt" IS NOT NULL AND "reasonCode" IS NULL AND "publicExplanation" IS NULL) OR
    ("state" = 'REJECTED' AND "decidedByAdminUserId" IS NOT NULL AND "decidedAt" IS NOT NULL AND "publishedAt" IS NULL AND "reasonCode" IS NOT NULL AND length("publicExplanation") BETWEEN 20 AND 1000)
  )
);

CREATE TABLE "JobPostReviewHistory" (
  "id" TEXT NOT NULL,
  "reviewVersionId" TEXT NOT NULL,
  "action" "JobPostReviewHistoryAction" NOT NULL,
  "actorUserId" TEXT,
  "priorState" "JobPostReviewState",
  "resultingState" "JobPostReviewState" NOT NULL,
  "priorAssigneeUserId" TEXT,
  "resultingAssigneeUserId" TEXT,
  "resultingAggregateVersion" INTEGER NOT NULL,
  "correlationId" VARCHAR(128) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobPostReviewHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobPostReviewPrivateNote" (
  "id" TEXT NOT NULL,
  "reviewVersionId" TEXT NOT NULL,
  "authorAdminUserId" TEXT NOT NULL,
  "normalizedText" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobPostReviewPrivateNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobPostReviewPrivateNote_text_check" CHECK (length("normalizedText") BETWEEN 1 AND 2000)
);

CREATE TABLE "JobCatalogueWriteLease" (
  "catalogueKey" CHAR(64) NOT NULL,
  "ownerTokenHash" CHAR(64) NOT NULL,
  "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
  "expectedCatalogueSha256" CHAR(64) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobCatalogueWriteLease_pkey" PRIMARY KEY ("catalogueKey"),
  CONSTRAINT "JobCatalogueWriteLease_version_check" CHECK ("version" >= 1),
  CONSTRAINT "JobCatalogueWriteLease_digests_check" CHECK (
    "catalogueKey" ~ '^[a-f0-9]{64}$' AND "ownerTokenHash" ~ '^[a-f0-9]{64}$' AND
    "expectedCatalogueSha256" ~ '^[a-f0-9]{64}$'
  )
);

CREATE UNIQUE INDEX "JobPostReviewAggregate_jobId_key" ON "JobPostReviewAggregate"("jobId");
CREATE UNIQUE INDEX "JobPostReviewAggregate_pendingVersionId_key" ON "JobPostReviewAggregate"("pendingVersionId");
CREATE UNIQUE INDEX "JobPostReviewAggregate_approvedVersionId_key" ON "JobPostReviewAggregate"("approvedVersionId");
CREATE UNIQUE INDEX "JobPostReviewAggregate_publicJobPostingId_key" ON "JobPostReviewAggregate"("publicJobPostingId");
CREATE INDEX "JobPostReviewAggregate_companyId_updatedAt_id_idx" ON "JobPostReviewAggregate"("companyId", "updatedAt" DESC, "id");
CREATE UNIQUE INDEX "JobPostReviewVersion_reviewAggregateId_sequence_key" ON "JobPostReviewVersion"("reviewAggregateId", "sequence");
CREATE UNIQUE INDEX "JobPostReviewVersion_reviewAggregateId_snapshotSha256_key" ON "JobPostReviewVersion"("reviewAggregateId", "snapshotSha256");
CREATE UNIQUE INDEX "JobPostReviewVersion_submission_actor_key" ON "JobPostReviewVersion"("submittedByUserId", "submissionIdempotencyKey");
CREATE UNIQUE INDEX "JobPostReviewVersion_decisionCorrelationId_key" ON "JobPostReviewVersion"("decisionCorrelationId");
CREATE UNIQUE INDEX "JobPostReviewVersion_one_pending_per_aggregate_key"
  ON "JobPostReviewVersion"("reviewAggregateId") WHERE "state" = 'PENDING_REVIEW';
CREATE INDEX "JobPostReviewVersion_state_submittedAt_id_idx" ON "JobPostReviewVersion"("state", "submittedAt", "id");
CREATE INDEX "JobPostReviewVersion_assignedAdminUserId_state_submittedAt_idx" ON "JobPostReviewVersion"("assignedAdminUserId", "state", "submittedAt");
CREATE UNIQUE INDEX "JobPostReviewHistory_reviewVersionId_resultingAggregateVersion_action_key" ON "JobPostReviewHistory"("reviewVersionId", "resultingAggregateVersion", "action");
CREATE INDEX "JobPostReviewHistory_reviewVersionId_occurredAt_id_idx" ON "JobPostReviewHistory"("reviewVersionId", "occurredAt", "id");
CREATE INDEX "JobPostReviewPrivateNote_reviewVersionId_createdAt_id_idx" ON "JobPostReviewPrivateNote"("reviewVersionId", "createdAt", "id");
CREATE INDEX "JobCatalogueWriteLease_leaseExpiresAt_idx" ON "JobCatalogueWriteLease"("leaseExpiresAt");

ALTER TABLE "JobPostReviewAggregate" ADD CONSTRAINT "JobPostReviewAggregate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobPostReviewAggregate" ADD CONSTRAINT "JobPostReviewAggregate_publicJobPostingId_fkey" FOREIGN KEY ("publicJobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobPostReviewAggregate" ADD CONSTRAINT "JobPostReviewAggregate_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobPostReviewVersion" ADD CONSTRAINT "JobPostReviewVersion_reviewAggregateId_fkey" FOREIGN KEY ("reviewAggregateId") REFERENCES "JobPostReviewAggregate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobPostReviewVersion" ADD CONSTRAINT "JobPostReviewVersion_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobPostReviewVersion" ADD CONSTRAINT "JobPostReviewVersion_submittedMembershipId_fkey" FOREIGN KEY ("submittedMembershipId") REFERENCES "CompanyMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobPostReviewVersion" ADD CONSTRAINT "JobPostReviewVersion_assignedAdminUserId_fkey" FOREIGN KEY ("assignedAdminUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobPostReviewVersion" ADD CONSTRAINT "JobPostReviewVersion_decidedByAdminUserId_fkey" FOREIGN KEY ("decidedByAdminUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobPostReviewAggregate" ADD CONSTRAINT "JobPostReviewAggregate_pendingVersionId_fkey" FOREIGN KEY ("pendingVersionId") REFERENCES "JobPostReviewVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobPostReviewAggregate" ADD CONSTRAINT "JobPostReviewAggregate_approvedVersionId_fkey" FOREIGN KEY ("approvedVersionId") REFERENCES "JobPostReviewVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobPostReviewHistory" ADD CONSTRAINT "JobPostReviewHistory_reviewVersionId_fkey" FOREIGN KEY ("reviewVersionId") REFERENCES "JobPostReviewVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobPostReviewHistory" ADD CONSTRAINT "JobPostReviewHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobPostReviewPrivateNote" ADD CONSTRAINT "JobPostReviewPrivateNote_reviewVersionId_fkey" FOREIGN KEY ("reviewVersionId") REFERENCES "JobPostReviewVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobPostReviewPrivateNote" ADD CONSTRAINT "JobPostReviewPrivateNote_authorAdminUserId_fkey" FOREIGN KEY ("authorAdminUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
