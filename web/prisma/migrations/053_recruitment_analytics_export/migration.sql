CREATE TYPE "AnalyticsViewQualification" AS ENUM ('QUALIFIED', 'OWNER_PREVIEW', 'AUTOMATED', 'INVALID');
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'XLSX');
CREATE TYPE "ExportRequestStatus" AS ENUM ('QUEUED', 'LEASED', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'DELETING', 'DELETED');

CREATE TABLE "JobPostingViewFact" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "platformDay" DATE NOT NULL,
    "visitorDayDigest" TEXT NOT NULL,
    "digestVersion" INTEGER NOT NULL,
    "qualification" "AnalyticsViewQualification" NOT NULL,
    "qualificationPolicyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobPostingViewFact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobPostingLifecycleFact" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromStatus" "JobPostingStatus",
    "toStatus" "JobPostingStatus" NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "postingVersion" INTEGER NOT NULL,
    "actorUserId" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobPostingLifecycleFact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExportRequest" (
    "id" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "filters" JSONB NOT NULL,
    "rangeStart" TIMESTAMP(3),
    "rangeEnd" TIMESTAMP(3),
    "timeZone" TEXT NOT NULL,
    "dataCutoff" TIMESTAMP(3) NOT NULL,
    "definitionVersion" TEXT NOT NULL,
    "status" "ExportRequestStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "storageLocator" TEXT,
    "fileName" TEXT,
    "mediaType" TEXT,
    "byteCount" INTEGER,
    "checksum" TEXT,
    "rowCount" INTEGER,
    "failureCode" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "inaccessibleAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ExportRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityLegalHold" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeReference" TEXT NOT NULL,
    "reasonCategory" TEXT NOT NULL,
    "authorizedByAdminUserId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLegalHold_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobPostingViewFact_qualified_visitor_day_key"
    ON "JobPostingViewFact" ("jobPostingId", "platformDay", "visitorDayDigest", "digestVersion");
CREATE INDEX "JobPostingViewFact_jobPostingId_occurredAt_idx"
    ON "JobPostingViewFact" ("jobPostingId", "occurredAt");
CREATE INDEX "JobPostingViewFact_companyId_occurredAt_idx"
    ON "JobPostingViewFact" ("companyId", "occurredAt");
CREATE INDEX "JobPostingViewFact_qualification_occurredAt_idx"
    ON "JobPostingViewFact" ("qualification", "occurredAt");

CREATE UNIQUE INDEX "JobPostingLifecycleFact_jobPostingId_postingVersion_key"
    ON "JobPostingLifecycleFact" ("jobPostingId", "postingVersion");
CREATE INDEX "JobPostingLifecycleFact_jobPostingId_effectiveAt_idx"
    ON "JobPostingLifecycleFact" ("jobPostingId", "effectiveAt");
CREATE INDEX "JobPostingLifecycleFact_companyId_effectiveAt_idx"
    ON "JobPostingLifecycleFact" ("companyId", "effectiveAt");

CREATE UNIQUE INDEX "ExportRequest_requesterUserId_idempotencyKey_key"
    ON "ExportRequest" ("requesterUserId", "idempotencyKey");
CREATE INDEX "ExportRequest_claim_idx"
    ON "ExportRequest" ("status", "leaseExpiresAt", "requestedAt");
CREATE INDEX "ExportRequest_cleanup_idx"
    ON "ExportRequest" ("status", "expiresAt");
CREATE INDEX "ExportRequest_requesterUserId_jobPostingId_requestedAt_idx"
    ON "ExportRequest" ("requesterUserId", "jobPostingId", "requestedAt" DESC);

CREATE INDEX "ActivityLegalHold_scope_idx"
    ON "ActivityLegalHold" ("scopeType", "scopeReference", "startsAt", "endsAt");
CREATE INDEX "ActivityLegalHold_expiry_idx"
    ON "ActivityLegalHold" ("endsAt", "releasedAt");
CREATE INDEX "AuditEvent_analytics_retention_idx"
    ON "AuditEvent" ("occurredAt", "id");

ALTER TABLE "JobPostingViewFact"
    ADD CONSTRAINT "JobPostingViewFact_jobPostingId_fkey"
    FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobPostingViewFact"
    ADD CONSTRAINT "JobPostingViewFact_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobPostingLifecycleFact"
    ADD CONSTRAINT "JobPostingLifecycleFact_jobPostingId_fkey"
    FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobPostingLifecycleFact"
    ADD CONSTRAINT "JobPostingLifecycleFact_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobPostingLifecycleFact"
    ADD CONSTRAINT "JobPostingLifecycleFact_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExportRequest"
    ADD CONSTRAINT "ExportRequest_requesterUserId_fkey"
    FOREIGN KEY ("requesterUserId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportRequest"
    ADD CONSTRAINT "ExportRequest_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportRequest"
    ADD CONSTRAINT "ExportRequest_jobPostingId_fkey"
    FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityLegalHold"
    ADD CONSTRAINT "ActivityLegalHold_authorizedByAdminUserId_fkey"
    FOREIGN KEY ("authorizedByAdminUserId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "JobPostingLifecycleFact"
    ("id", "jobPostingId", "companyId", "fromStatus", "toStatus", "effectiveAt", "postingVersion", "actorUserId", "correlationId")
SELECT
    'analytics-baseline-' || "id",
    "id",
    "companyId",
    NULL,
    "status",
    CURRENT_TIMESTAMP,
    "version",
    NULL,
    'analytics-baseline-v1:' || "id"
FROM "JobPosting"
ON CONFLICT ("jobPostingId", "postingVersion") DO NOTHING;
