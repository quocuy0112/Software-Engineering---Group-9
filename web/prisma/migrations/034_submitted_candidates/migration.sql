-- Group 1 is additive. JobApplication remains authoritative; these tables
-- hold immutable application-owned evidence and cleanup state.

DO $$ BEGIN
  CREATE TYPE "ApplicationDocumentKind" AS ENUM ('CV', 'COVER_LETTER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "ApplicationArtifactPromotionState" AS ENUM ('PROMOTED', 'COMMITTED', 'DELETE_PENDING', 'DELETING', 'DELETED', 'DELETE_FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "ApplicationLegacyDocumentState" AS ENUM ('CURRENT', 'BACKFILLABLE', 'UNAVAILABLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "JobApplication"
  ADD COLUMN IF NOT EXISTS "documentRetentionDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "documentAccessDeniedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "documentDeletionDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "documentDeletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "legacyDocumentState" "ApplicationLegacyDocumentState" NOT NULL DEFAULT 'CURRENT';

CREATE TABLE IF NOT EXISTS "ApplicationDocument" (
  "id" TEXT NOT NULL,
  "jobApplicationId" TEXT NOT NULL,
  "kind" "ApplicationDocumentKind" NOT NULL,
  "storagePurposeVersion" TEXT NOT NULL DEFAULT 'application-document-v1',
  "storageKeyEncrypted" TEXT NOT NULL,
  "originalFilenameEncrypted" TEXT NOT NULL,
  "mediaType" TEXT NOT NULL,
  "byteLength" INTEGER NOT NULL,
  "contentDigestHmac" TEXT NOT NULL,
  "sourceCandidateCvId" TEXT,
  "sourceCandidateCvVersion" INTEGER,
  "safetyAssessmentId" TEXT NOT NULL,
  "committedAt" TIMESTAMP(3),
  "ordinaryAccessDeniedAt" TIMESTAMP(3),
  "deleteAfter" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApplicationCoverLetterText" (
  "jobApplicationId" TEXT NOT NULL,
  "textEncrypted" TEXT NOT NULL,
  "characterCount" INTEGER NOT NULL,
  "ordinaryAccessDeniedAt" TIMESTAMP(3),
  "deleteAfter" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationCoverLetterText_pkey" PRIMARY KEY ("jobApplicationId")
);

CREATE TABLE IF NOT EXISTS "ApplicationArtifactPromotion" (
  "id" TEXT NOT NULL,
  "candidateUserId" TEXT NOT NULL,
  "jobPostingId" TEXT NOT NULL,
  "jobApplicationId" TEXT,
  "kind" "ApplicationDocumentKind" NOT NULL,
  "storagePurposeVersion" TEXT NOT NULL DEFAULT 'application-document-v1',
  "storageKeyEncrypted" TEXT NOT NULL,
  "state" "ApplicationArtifactPromotionState" NOT NULL DEFAULT 'PROMOTED',
  "orphanDeleteAfter" TIMESTAMP(3) NOT NULL,
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastSafeFailureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ApplicationArtifactPromotion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApplicationDocumentLegalHold" (
  "id" TEXT NOT NULL,
  "jobApplicationId" TEXT NOT NULL,
  "purposeCode" VARCHAR(80) NOT NULL,
  "policyVersion" VARCHAR(40) NOT NULL,
  "issuedByAdminUserId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "reviewAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationDocumentLegalHold_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationDocument_jobApplicationId_kind_key"
  ON "ApplicationDocument"("jobApplicationId", "kind");
CREATE INDEX IF NOT EXISTS "ApplicationDocument_ordinaryAccessDeniedAt_deletedAt_idx"
  ON "ApplicationDocument"("ordinaryAccessDeniedAt", "deletedAt");
CREATE INDEX IF NOT EXISTS "ApplicationDocument_deleteAfter_deletedAt_idx"
  ON "ApplicationDocument"("deleteAfter", "deletedAt");
CREATE INDEX IF NOT EXISTS "ApplicationArtifactPromotion_state_orphanDeleteAfter_idx"
  ON "ApplicationArtifactPromotion"("state", "orphanDeleteAfter");
CREATE INDEX IF NOT EXISTS "ApplicationArtifactPromotion_jobApplicationId_kind_idx"
  ON "ApplicationArtifactPromotion"("jobApplicationId", "kind");
CREATE INDEX IF NOT EXISTS "ApplicationArtifactPromotion_leaseExpiresAt_idx"
  ON "ApplicationArtifactPromotion"("leaseExpiresAt");
CREATE INDEX IF NOT EXISTS "ApplicationDocumentLegalHold_jobApplicationId_endsAt_releasedAt_idx"
  ON "ApplicationDocumentLegalHold"("jobApplicationId", "endsAt", "releasedAt");
CREATE INDEX IF NOT EXISTS "ApplicationDocumentLegalHold_issuedByAdminUserId_createdAt_idx"
  ON "ApplicationDocumentLegalHold"("issuedByAdminUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "JobApplication_jobPostingId_submittedAt_id_idx"
  ON "JobApplication"("jobPostingId", "submittedAt" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "JobApplication_documentDeletedAt_documentDeletionDueAt_idx"
  ON "JobApplication"("documentDeletedAt", "documentDeletionDueAt");

-- Only rows whose stored CV snapshot still agrees with the selected CV are
-- safely backfillable. All other historical rows remain visible to operations
-- as UNAVAILABLE and are excluded from the complete-document projection.
UPDATE "JobApplication"
SET "legacyDocumentState" = 'UNAVAILABLE'::"ApplicationLegacyDocumentState";

UPDATE "JobApplication" application
SET "legacyDocumentState" = CASE
  WHEN cv."id" IS NOT NULL
   AND application."cvSnapshot"->>'storageKey' = cv."storageKey"
   AND application."cvSnapshot"->>'checksumSha256' = cv."checksumSha256"
   AND application."cvSnapshot"->>'cvVersion' = cv."version"::text
  THEN 'BACKFILLABLE'::"ApplicationLegacyDocumentState"
  ELSE 'UNAVAILABLE'::"ApplicationLegacyDocumentState"
END
FROM "CandidateCv" cv
WHERE cv."id" = application."selectedCvId";

INSERT INTO "ApplicationDocument" (
  "id", "jobApplicationId", "kind", "storageKeyEncrypted",
  "originalFilenameEncrypted", "mediaType", "byteLength",
  "contentDigestHmac", "sourceCandidateCvId", "sourceCandidateCvVersion",
  "safetyAssessmentId", "committedAt", "createdAt"
)
SELECT
  'application-document-' || md5(application."id" || '-cv'),
  application."id",
  'CV'::"ApplicationDocumentKind",
  cv."storageKey",
  cv."fileName",
  cv."mimeType",
  cv."byteSize",
  cv."checksumSha256",
  cv."id",
  cv."version",
  'migration-provenance-' || application."id",
  application."submittedAt",
  application."submittedAt"
FROM "JobApplication" application
JOIN "CandidateCv" cv ON cv."id" = application."selectedCvId"
WHERE application."legacyDocumentState" = 'BACKFILLABLE'
  AND NOT EXISTS (
    SELECT 1 FROM "ApplicationDocument" document
    WHERE document."jobApplicationId" = application."id"
      AND document."kind" = 'CV'::"ApplicationDocumentKind"
  );

INSERT INTO "ApplicationCoverLetterText" (
  "jobApplicationId", "textEncrypted", "characterCount", "createdAt"
)
SELECT
  application."id",
  'b64:v1:' || encode(convert_to(application."coverLetter", 'UTF8'), 'base64'),
  char_length(application."coverLetter"),
  application."submittedAt"
FROM "JobApplication" application
WHERE application."coverLetter" IS NOT NULL
  AND char_length(application."coverLetter") BETWEEN 1 AND 10000
  AND NOT EXISTS (
    SELECT 1 FROM "ApplicationCoverLetterText" text_row
    WHERE text_row."jobApplicationId" = application."id"
  );

DO $$ BEGIN
  ALTER TABLE "ApplicationDocument"
    ADD CONSTRAINT "ApplicationDocument_application_fkey"
    FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ApplicationDocument"
    ADD CONSTRAINT "ApplicationDocument_sourceCv_fkey"
    FOREIGN KEY ("sourceCandidateCvId") REFERENCES "CandidateCv"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ApplicationCoverLetterText"
    ADD CONSTRAINT "ApplicationCoverLetterText_application_fkey"
    FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ApplicationArtifactPromotion"
    ADD CONSTRAINT "ApplicationArtifactPromotion_candidate_fkey"
    FOREIGN KEY ("candidateUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ApplicationArtifactPromotion"
    ADD CONSTRAINT "ApplicationArtifactPromotion_job_fkey"
    FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ApplicationArtifactPromotion"
    ADD CONSTRAINT "ApplicationArtifactPromotion_application_fkey"
    FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ApplicationDocumentLegalHold"
    ADD CONSTRAINT "ApplicationDocumentLegalHold_application_fkey"
    FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ApplicationDocumentLegalHold"
    ADD CONSTRAINT "ApplicationDocumentLegalHold_issuer_fkey"
    FOREIGN KEY ("issuedByAdminUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
