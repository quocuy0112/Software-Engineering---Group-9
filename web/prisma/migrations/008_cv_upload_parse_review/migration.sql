-- Feature 004 is a forward-only additive migration.
-- Rollback safety: deploy application code that stops all Feature 004 writes,
-- drain worker leases, preserve immutable receipts/consent evidence, and take a
-- verified backup before any separately reviewed compensating migration. This
-- migration never drops or rewrites objects owned by migrations 001-007.

CREATE TYPE "CvDocumentKind" AS ENUM ('PDF', 'DOCX');
CREATE TYPE "CvParserClass" AS ENUM ('DETERMINISTIC_INTERNAL', 'EXTERNAL_OPENAI');
CREATE TYPE "CvUploadStatus" AS ENUM (
  'AWAITING_CONTENT', 'VALIDATION_QUEUED', 'SCAN_QUEUED', 'SCANNING',
  'EXTRACTION_QUEUED', 'EXTRACTING', 'AWAITING_CONSENT', 'PARSE_QUEUED',
  'PARSING', 'REVIEW_READY', 'VALIDATION_FAILED', 'INFECTED', 'SCAN_FAILED',
  'EXTRACTION_FAILED', 'PARSE_FAILED', 'CONFIRMED', 'CANCELLED', 'DELETED',
  'EXPIRED'
);
CREATE TYPE "CvArtifactKind" AS ENUM ('SOURCE_DOCUMENT', 'EXTRACTED_TEXT');
CREATE TYPE "CvArtifactStatus" AS ENUM (
  'QUARANTINED', 'AVAILABLE', 'DELETE_PENDING', 'DELETING', 'DELETED',
  'DELETE_FAILED'
);
CREATE TYPE "CvScanStatus" AS ENUM (
  'QUEUED', 'PROCESSING', 'CLEAN', 'INFECTED', 'INDETERMINATE', 'CANCELLED'
);
CREATE TYPE "CvExtractionStatus" AS ENUM (
  'QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'
);
CREATE TYPE "CvParseStatus" AS ENUM (
  'QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'
);
CREATE TYPE "CvParseTrigger" AS ENUM (
  'INITIAL', 'AUTOMATIC_RETRY', 'CANDIDATE_RETRY'
);
CREATE TYPE "CvRetryStage" AS ENUM ('SCAN', 'PARSE');
CREATE TYPE "CvDraftStatus" AS ENUM ('EDITABLE', 'CONFIRMED', 'DELETED', 'EXPIRED');
CREATE TYPE "CvConsentAction" AS ENUM ('GRANTED', 'REVOKED');

CREATE TABLE "CvAccountQuota" (
  "accountId" TEXT NOT NULL,
  "reservedBytes" INTEGER NOT NULL DEFAULT 0,
  "retainedBytes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CvAccountQuota_pkey" PRIMARY KEY ("accountId")
);

CREATE TABLE "CvUpload" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "documentKind" "CvDocumentKind" NOT NULL,
  "parserClass" "CvParserClass" NOT NULL,
  "status" "CvUploadStatus" NOT NULL DEFAULT 'AWAITING_CONTENT',
  "declaredMediaType" TEXT NOT NULL,
  "declaredBytes" INTEGER NOT NULL,
  "actualBytes" INTEGER,
  "quotaReservationBytes" INTEGER NOT NULL,
  "quotaReservationRemaining" INTEGER NOT NULL,
  "sourceSha256" BYTEA,
  "displayFilenameCiphertext" TEXT,
  "idempotencyDigest" BYTEA NOT NULL,
  "createBindingDigest" BYTEA NOT NULL,
  "failureCode" TEXT,
  "automaticScanAttemptsUsed" INTEGER NOT NULL DEFAULT 0,
  "candidateScanRetriesUsed" INTEGER NOT NULL DEFAULT 0,
  "automaticParseAttemptsUsed" INTEGER NOT NULL DEFAULT 0,
  "candidateParseRetriesUsed" INTEGER NOT NULL DEFAULT 0,
  "contentReceivedAt" TIMESTAMP(3),
  "contentInaccessibleAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "deleteAfter" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CvUpload_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CvStoredArtifact" (
  "id" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "kind" "CvArtifactKind" NOT NULL,
  "status" "CvArtifactStatus" NOT NULL DEFAULT 'QUARANTINED',
  "storageAdapter" TEXT NOT NULL,
  "storageLocator" TEXT NOT NULL,
  "encryptionKeyVersion" INTEGER NOT NULL,
  "encryptionIv" BYTEA NOT NULL,
  "authenticationTag" BYTEA NOT NULL,
  "plaintextBytes" INTEGER NOT NULL,
  "ciphertextBytes" INTEGER NOT NULL,
  "plaintextSha256" BYTEA NOT NULL,
  "availableAt" TIMESTAMP(3),
  "contentInaccessibleAt" TIMESTAMP(3),
  "deleteAfter" TIMESTAMP(3),
  "deleteLeaseOwner" TEXT,
  "deleteLeaseExpiresAt" TIMESTAMP(3),
  "deleteAttempts" INTEGER NOT NULL DEFAULT 0,
  "deleteFailureCode" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CvStoredArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CvScanAssessment" (
  "id" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "sourceArtifactId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "candidateInitiated" BOOLEAN NOT NULL DEFAULT false,
  "status" "CvScanStatus" NOT NULL DEFAULT 'QUEUED',
  "engineName" TEXT,
  "engineVersion" TEXT,
  "signatureVersion" TEXT,
  "signaturePublishedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CvScanAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CvExtraction" (
  "id" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "sourceArtifactId" TEXT NOT NULL,
  "scanAssessmentId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "outputArtifactId" TEXT,
  "attemptNumber" INTEGER NOT NULL,
  "status" "CvExtractionStatus" NOT NULL DEFAULT 'QUEUED',
  "extractorName" TEXT,
  "extractorVersion" TEXT,
  "rulesVersion" TEXT,
  "pageCount" INTEGER,
  "entryCount" INTEGER,
  "expandedBytes" INTEGER,
  "segmentCount" INTEGER,
  "extractedUtf8Bytes" INTEGER,
  "failureCode" TEXT,
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CvExtraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CvParseJob" (
  "id" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "extractionId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "consentEventId" TEXT,
  "previousAttemptId" TEXT,
  "attemptNumber" INTEGER NOT NULL,
  "trigger" "CvParseTrigger" NOT NULL,
  "status" "CvParseStatus" NOT NULL DEFAULT 'QUEUED',
  "parserClass" "CvParserClass" NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "purposeVersion" TEXT NOT NULL,
  "inputVersion" TEXT NOT NULL,
  "instructionVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "providerRequestIdHmac" BYTEA,
  "failureCode" TEXT,
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CvParseJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CvRetryRequest" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "stage" "CvRetryStage" NOT NULL,
  "idempotencyDigest" BYTEA NOT NULL,
  "priorScanAssessmentId" TEXT,
  "scanAssessmentId" TEXT,
  "priorParseJobId" TEXT,
  "parseJobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CvRetryRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CvDraft" (
  "id" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "parseJobId" TEXT NOT NULL,
  "status" "CvDraftStatus" NOT NULL DEFAULT 'EDITABLE',
  "schemaVersion" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "sourceProfileRevision" INTEGER NOT NULL,
  "reviewedProfileRevision" INTEGER NOT NULL,
  "proposalPayload" JSONB,
  "reviewPayload" JSONB,
  "provenancePayload" JSONB,
  "payloadBytes" INTEGER NOT NULL DEFAULT 0,
  "provenanceBytes" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "contentInaccessibleAt" TIMESTAMP(3),
  "payloadDeleteAfter" TIMESTAMP(3),
  "payloadDeletedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CvDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CvProcessingConsent" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "action" "CvConsentAction" NOT NULL,
  "supersedesConsentId" TEXT,
  "provider" TEXT NOT NULL,
  "providerClass" "CvParserClass" NOT NULL,
  "model" TEXT NOT NULL,
  "purposeVersion" TEXT NOT NULL,
  "noticeVersion" TEXT NOT NULL,
  "consentTextVersion" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CvProcessingConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CvImportConfirmation" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  "idempotencyDigest" BYTEA NOT NULL,
  "selectionManifestVersion" TEXT NOT NULL,
  "selectionManifestDigest" BYTEA NOT NULL,
  "selectionManifest" JSONB NOT NULL,
  "draftRevision" INTEGER NOT NULL,
  "sourceProfileRevision" INTEGER NOT NULL,
  "reviewedProfileRevision" INTEGER NOT NULL,
  "profileRevisionBefore" INTEGER NOT NULL,
  "profileRevisionAfter" INTEGER NOT NULL,
  "appliedScalarCount" INTEGER NOT NULL DEFAULT 0,
  "appliedExperienceCount" INTEGER NOT NULL DEFAULT 0,
  "appliedEducationCount" INTEGER NOT NULL DEFAULT 0,
  "appliedSkillCount" INTEGER NOT NULL DEFAULT 0,
  "appliedSocialLinkCount" INTEGER NOT NULL DEFAULT 0,
  "confirmedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CvImportConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CvUpload_accountId_idempotencyDigest_key"
  ON "CvUpload"("accountId", "idempotencyDigest");
CREATE INDEX "CvUpload_accountId_createdAt_idx"
  ON "CvUpload"("accountId", "createdAt" DESC);
CREATE INDEX "CvUpload_status_expiresAt_idx" ON "CvUpload"("status", "expiresAt");
CREATE INDEX "CvUpload_deleteAfter_idx" ON "CvUpload"("deleteAfter");
CREATE INDEX "CvUpload_profileId_idx" ON "CvUpload"("profileId");
CREATE INDEX "CvUpload_delete_due_idx" ON "CvUpload"("deleteAfter")
  WHERE "deletedAt" IS NULL AND "deleteAfter" IS NOT NULL;

CREATE UNIQUE INDEX "CvStoredArtifact_storageAdapter_storageLocator_key"
  ON "CvStoredArtifact"("storageAdapter", "storageLocator");
CREATE INDEX "CvStoredArtifact_uploadId_kind_idx"
  ON "CvStoredArtifact"("uploadId", "kind");
CREATE INDEX "CvStoredArtifact_status_deleteAfter_deleteLeaseExpiresAt_idx"
  ON "CvStoredArtifact"("status", "deleteAfter", "deleteLeaseExpiresAt");
CREATE INDEX "CvStoredArtifact_accountId_idx" ON "CvStoredArtifact"("accountId");
CREATE UNIQUE INDEX "CvStoredArtifact_one_live_kind_idx"
  ON "CvStoredArtifact"("uploadId", "kind") WHERE "status" <> 'DELETED';

CREATE UNIQUE INDEX "CvScanAssessment_uploadId_attemptNumber_key"
  ON "CvScanAssessment"("uploadId", "attemptNumber");
CREATE INDEX "CvScanAssessment_claim_idx"
  ON "CvScanAssessment"("status", "leaseExpiresAt", "createdAt");
CREATE INDEX "CvScanAssessment_accountId_idx" ON "CvScanAssessment"("accountId");

CREATE UNIQUE INDEX "CvExtraction_outputArtifactId_key"
  ON "CvExtraction"("outputArtifactId");
CREATE UNIQUE INDEX "CvExtraction_uploadId_attemptNumber_key"
  ON "CvExtraction"("uploadId", "attemptNumber");
CREATE INDEX "CvExtraction_claim_idx"
  ON "CvExtraction"("status", "leaseExpiresAt", "createdAt");
CREATE INDEX "CvExtraction_accountId_idx" ON "CvExtraction"("accountId");

CREATE UNIQUE INDEX "CvParseJob_uploadId_attemptNumber_key"
  ON "CvParseJob"("uploadId", "attemptNumber");
CREATE INDEX "CvParseJob_claim_idx"
  ON "CvParseJob"("status", "leaseExpiresAt", "createdAt");
CREATE INDEX "CvParseJob_accountId_idx" ON "CvParseJob"("accountId");
CREATE INDEX "CvParseJob_previousAttemptId_idx" ON "CvParseJob"("previousAttemptId");
CREATE UNIQUE INDEX "CvParseJob_one_active_per_account_idx"
  ON "CvParseJob"("accountId") WHERE "status" IN ('QUEUED', 'PROCESSING');
CREATE UNIQUE INDEX "CvParseJob_one_retry_per_prior_idx"
  ON "CvParseJob"("previousAttemptId") WHERE "previousAttemptId" IS NOT NULL;

CREATE UNIQUE INDEX "CvRetryRequest_accountId_idempotencyDigest_key"
  ON "CvRetryRequest"("accountId", "idempotencyDigest");
CREATE INDEX "CvRetryRequest_uploadId_createdAt_idx"
  ON "CvRetryRequest"("uploadId", "createdAt");

CREATE UNIQUE INDEX "CvDraft_uploadId_key" ON "CvDraft"("uploadId");
CREATE UNIQUE INDEX "CvDraft_parseJobId_key" ON "CvDraft"("parseJobId");
CREATE INDEX "CvDraft_accountId_status_idx" ON "CvDraft"("accountId", "status");
CREATE INDEX "CvDraft_expiresAt_idx" ON "CvDraft"("expiresAt");
CREATE INDEX "CvDraft_payloadDeleteAfter_idx" ON "CvDraft"("payloadDeleteAfter");

CREATE INDEX "CvProcessingConsent_uploadId_occurredAt_idx"
  ON "CvProcessingConsent"("uploadId", "occurredAt" DESC);
CREATE INDEX "CvProcessingConsent_accountId_occurredAt_idx"
  ON "CvProcessingConsent"("accountId", "occurredAt" DESC);
CREATE INDEX "CvProcessingConsent_supersedesConsentId_idx"
  ON "CvProcessingConsent"("supersedesConsentId");

CREATE UNIQUE INDEX "CvImportConfirmation_uploadId_key"
  ON "CvImportConfirmation"("uploadId");
CREATE UNIQUE INDEX "CvImportConfirmation_draftId_key"
  ON "CvImportConfirmation"("draftId");
CREATE UNIQUE INDEX "CvImportConfirmation_accountId_idempotencyDigest_key"
  ON "CvImportConfirmation"("accountId", "idempotencyDigest");
CREATE INDEX "CvImportConfirmation_profileId_confirmedAt_idx"
  ON "CvImportConfirmation"("profileId", "confirmedAt" DESC);

ALTER TABLE "CvAccountQuota" ADD CONSTRAINT "CvAccountQuota_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvUpload" ADD CONSTRAINT "CvUpload_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvUpload" ADD CONSTRAINT "CvUpload_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvStoredArtifact" ADD CONSTRAINT "CvStoredArtifact_uploadId_fkey"
  FOREIGN KEY ("uploadId") REFERENCES "CvUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvStoredArtifact" ADD CONSTRAINT "CvStoredArtifact_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvScanAssessment" ADD CONSTRAINT "CvScanAssessment_uploadId_fkey"
  FOREIGN KEY ("uploadId") REFERENCES "CvUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvScanAssessment" ADD CONSTRAINT "CvScanAssessment_sourceArtifactId_fkey"
  FOREIGN KEY ("sourceArtifactId") REFERENCES "CvStoredArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvScanAssessment" ADD CONSTRAINT "CvScanAssessment_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvExtraction" ADD CONSTRAINT "CvExtraction_uploadId_fkey"
  FOREIGN KEY ("uploadId") REFERENCES "CvUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvExtraction" ADD CONSTRAINT "CvExtraction_sourceArtifactId_fkey"
  FOREIGN KEY ("sourceArtifactId") REFERENCES "CvStoredArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvExtraction" ADD CONSTRAINT "CvExtraction_scanAssessmentId_fkey"
  FOREIGN KEY ("scanAssessmentId") REFERENCES "CvScanAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvExtraction" ADD CONSTRAINT "CvExtraction_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvExtraction" ADD CONSTRAINT "CvExtraction_outputArtifactId_fkey"
  FOREIGN KEY ("outputArtifactId") REFERENCES "CvStoredArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CvParseJob" ADD CONSTRAINT "CvParseJob_uploadId_fkey"
  FOREIGN KEY ("uploadId") REFERENCES "CvUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvParseJob" ADD CONSTRAINT "CvParseJob_extractionId_fkey"
  FOREIGN KEY ("extractionId") REFERENCES "CvExtraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvParseJob" ADD CONSTRAINT "CvParseJob_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvParseJob" ADD CONSTRAINT "CvParseJob_consentEventId_fkey"
  FOREIGN KEY ("consentEventId") REFERENCES "CvProcessingConsent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CvParseJob" ADD CONSTRAINT "CvParseJob_previousAttemptId_fkey"
  FOREIGN KEY ("previousAttemptId") REFERENCES "CvParseJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CvRetryRequest" ADD CONSTRAINT "CvRetryRequest_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvRetryRequest" ADD CONSTRAINT "CvRetryRequest_uploadId_fkey"
  FOREIGN KEY ("uploadId") REFERENCES "CvUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvRetryRequest" ADD CONSTRAINT "CvRetryRequest_priorScanAssessmentId_fkey"
  FOREIGN KEY ("priorScanAssessmentId") REFERENCES "CvScanAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CvRetryRequest" ADD CONSTRAINT "CvRetryRequest_scanAssessmentId_fkey"
  FOREIGN KEY ("scanAssessmentId") REFERENCES "CvScanAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CvRetryRequest" ADD CONSTRAINT "CvRetryRequest_priorParseJobId_fkey"
  FOREIGN KEY ("priorParseJobId") REFERENCES "CvParseJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CvRetryRequest" ADD CONSTRAINT "CvRetryRequest_parseJobId_fkey"
  FOREIGN KEY ("parseJobId") REFERENCES "CvParseJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CvDraft" ADD CONSTRAINT "CvDraft_uploadId_fkey"
  FOREIGN KEY ("uploadId") REFERENCES "CvUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvDraft" ADD CONSTRAINT "CvDraft_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvDraft" ADD CONSTRAINT "CvDraft_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvDraft" ADD CONSTRAINT "CvDraft_parseJobId_fkey"
  FOREIGN KEY ("parseJobId") REFERENCES "CvParseJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvProcessingConsent" ADD CONSTRAINT "CvProcessingConsent_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvProcessingConsent" ADD CONSTRAINT "CvProcessingConsent_uploadId_fkey"
  FOREIGN KEY ("uploadId") REFERENCES "CvUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvProcessingConsent" ADD CONSTRAINT "CvProcessingConsent_supersedesConsentId_fkey"
  FOREIGN KEY ("supersedesConsentId") REFERENCES "CvProcessingConsent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CvImportConfirmation" ADD CONSTRAINT "CvImportConfirmation_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvImportConfirmation" ADD CONSTRAINT "CvImportConfirmation_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvImportConfirmation" ADD CONSTRAINT "CvImportConfirmation_uploadId_fkey"
  FOREIGN KEY ("uploadId") REFERENCES "CvUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CvImportConfirmation" ADD CONSTRAINT "CvImportConfirmation_draftId_fkey"
  FOREIGN KEY ("draftId") REFERENCES "CvDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CvAccountQuota" ADD CONSTRAINT "CvAccountQuota_bytes_nonnegative"
  CHECK ("reservedBytes" >= 0 AND "retainedBytes" >= 0);
ALTER TABLE "CvAccountQuota" ADD CONSTRAINT "CvAccountQuota_total_cap"
  CHECK ("reservedBytes" + "retainedBytes" <= 52428800);

ALTER TABLE "CvUpload" ADD CONSTRAINT "CvUpload_declared_bytes"
  CHECK (
    "declaredBytes" BETWEEN 1 AND 5000000 AND
    (("documentKind" = 'PDF' AND "declaredMediaType" = 'application/pdf') OR
     ("documentKind" = 'DOCX' AND "declaredMediaType" = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
  );
ALTER TABLE "CvUpload" ADD CONSTRAINT "CvUpload_actual_integrity"
  CHECK (
    (("actualBytes" IS NULL AND "sourceSha256" IS NULL AND "contentReceivedAt" IS NULL) OR
     ("actualBytes" BETWEEN 1 AND 5000000 AND octet_length("sourceSha256") = 32 AND "contentReceivedAt" IS NOT NULL))
  );
ALTER TABLE "CvUpload" ADD CONSTRAINT "CvUpload_quota_reservation"
  CHECK (
    "quotaReservationBytes" = "declaredBytes" + 524288 AND
    "quotaReservationRemaining" BETWEEN 0 AND "quotaReservationBytes" AND
    "automaticScanAttemptsUsed" BETWEEN 0 AND 3 AND
    "candidateScanRetriesUsed" BETWEEN 0 AND 2 AND
    "automaticParseAttemptsUsed" BETWEEN 0 AND 3 AND
    "candidateParseRetriesUsed" BETWEEN 0 AND 2
  );
ALTER TABLE "CvUpload" ADD CONSTRAINT "CvUpload_terminal_access"
  CHECK (
    ("status" NOT IN ('CANCELLED', 'DELETED', 'EXPIRED') OR "contentInaccessibleAt" IS NOT NULL) AND
    ("status" <> 'DELETED' OR "deletedAt" IS NOT NULL) AND
    ("status" <> 'CONFIRMED' OR "confirmedAt" IS NOT NULL) AND
    ("expiresAt" = "createdAt" + INTERVAL '30 days')
  );

ALTER TABLE "CvStoredArtifact" ADD CONSTRAINT "CvStoredArtifact_envelope_sizes"
  CHECK (
    "encryptionKeyVersion" > 0 AND octet_length("encryptionIv") = 12 AND
    octet_length("authenticationTag") = 16 AND octet_length("plaintextSha256") = 32 AND
    "plaintextBytes" >= 0 AND "plaintextBytes" <= 5000000 AND
    "ciphertextBytes" >= "plaintextBytes" AND "ciphertextBytes" <= 5000016 AND
    "deleteAttempts" BETWEEN 0 AND 100
  );
ALTER TABLE "CvStoredArtifact" ADD CONSTRAINT "CvStoredArtifact_state"
  CHECK (
    ("status" = 'DELETED' AND "deletedAt" IS NOT NULL) OR
    ("status" <> 'DELETED' AND "deletedAt" IS NULL)
  );

ALTER TABLE "CvScanAssessment" ADD CONSTRAINT "CvScanAssessment_attempt_number"
  CHECK ("attemptNumber" BETWEEN 1 AND 5);
ALTER TABLE "CvScanAssessment" ADD CONSTRAINT "CvScanAssessment_terminal"
  CHECK (
    (("status" = 'PROCESSING' AND "leaseOwner" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL AND "startedAt" IS NOT NULL) OR
     ("status" <> 'PROCESSING' AND "leaseOwner" IS NULL AND "leaseExpiresAt" IS NULL)) AND
    ("status" NOT IN ('CLEAN', 'INFECTED', 'INDETERMINATE', 'CANCELLED') OR "completedAt" IS NOT NULL) AND
    ("status" <> 'CLEAN' OR ("engineName" IS NOT NULL AND "engineVersion" IS NOT NULL AND
      "signatureVersion" IS NOT NULL AND "signaturePublishedAt" IS NOT NULL AND "failureCode" IS NULL))
  );

ALTER TABLE "CvExtraction" ADD CONSTRAINT "CvExtraction_success"
  CHECK (
    "attemptNumber" BETWEEN 1 AND 5 AND
    (("status" = 'PROCESSING' AND "leaseOwner" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL AND "startedAt" IS NOT NULL) OR
     ("status" <> 'PROCESSING' AND "leaseOwner" IS NULL AND "leaseExpiresAt" IS NULL)) AND
    ("pageCount" IS NULL OR "pageCount" BETWEEN 1 AND 20) AND
    ("entryCount" IS NULL OR "entryCount" BETWEEN 1 AND 1000) AND
    ("expandedBytes" IS NULL OR "expandedBytes" BETWEEN 0 AND 26214400) AND
    ("status" <> 'SUCCEEDED' OR ("outputArtifactId" IS NOT NULL AND "segmentCount" > 0 AND
      "extractedUtf8Bytes" BETWEEN 1 AND 524288 AND "completedAt" IS NOT NULL AND "failureCode" IS NULL)) AND
    ("status" NOT IN ('FAILED', 'CANCELLED') OR "completedAt" IS NOT NULL)
  );

ALTER TABLE "CvParseJob" ADD CONSTRAINT "CvParseJob_terminal"
  CHECK (
    "attemptNumber" BETWEEN 1 AND 5 AND
    char_length("provider") BETWEEN 1 AND 100 AND char_length("model") BETWEEN 1 AND 200 AND
    char_length("purposeVersion") BETWEEN 1 AND 100 AND
    "inputVersion" = 'cv-segments-v1' AND "instructionVersion" = 'cv-extract-v1' AND
    "schemaVersion" = 'cv-draft-v1' AND
    ("providerRequestIdHmac" IS NULL OR octet_length("providerRequestIdHmac") = 32) AND
    (("status" = 'PROCESSING' AND "leaseOwner" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL AND "startedAt" IS NOT NULL) OR
     ("status" <> 'PROCESSING' AND "leaseOwner" IS NULL AND "leaseExpiresAt" IS NULL)) AND
    ("status" NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED') OR "completedAt" IS NOT NULL) AND
    ("parserClass" <> 'EXTERNAL_OPENAI' OR "status" NOT IN ('PROCESSING', 'SUCCEEDED') OR "consentEventId" IS NOT NULL)
  );

ALTER TABLE "CvRetryRequest" ADD CONSTRAINT "CvRetryRequest_stage_binding"
  CHECK (
    octet_length("idempotencyDigest") = 32 AND
    (("stage" = 'SCAN' AND "priorScanAssessmentId" IS NOT NULL AND "scanAssessmentId" IS NOT NULL AND
      "priorParseJobId" IS NULL AND "parseJobId" IS NULL) OR
     ("stage" = 'PARSE' AND "priorParseJobId" IS NOT NULL AND "parseJobId" IS NOT NULL AND
      "priorScanAssessmentId" IS NULL AND "scanAssessmentId" IS NULL))
  );

ALTER TABLE "CvDraft" ADD CONSTRAINT "CvDraft_json_caps"
  CHECK (
    "schemaVersion" = 'cv-draft-v1' AND "revision" >= 0 AND
    "payloadBytes" BETWEEN 0 AND 262144 AND "provenanceBytes" BETWEEN 0 AND 131072 AND
    COALESCE(octet_length("proposalPayload"::text), 0) + COALESCE(octet_length("reviewPayload"::text), 0) <= 262144 AND
    COALESCE(octet_length("provenancePayload"::text), 0) <= 131072 AND
    ("payloadDeletedAt" IS NULL OR ("proposalPayload" IS NULL AND "reviewPayload" IS NULL AND "provenancePayload" IS NULL))
  );
ALTER TABLE "CvDraft" ADD CONSTRAINT "CvDraft_state"
  CHECK (
    "sourceProfileRevision" >= 0 AND "reviewedProfileRevision" >= 0 AND
    ("status" <> 'CONFIRMED' OR ("confirmedAt" IS NOT NULL AND "contentInaccessibleAt" IS NOT NULL)) AND
    ("status" NOT IN ('DELETED', 'EXPIRED') OR "contentInaccessibleAt" IS NOT NULL)
  );

ALTER TABLE "CvProcessingConsent" ADD CONSTRAINT "CvProcessingConsent_binding"
  CHECK (
    char_length("provider") BETWEEN 1 AND 100 AND char_length("model") BETWEEN 1 AND 200 AND
    char_length("purposeVersion") BETWEEN 1 AND 100 AND
    char_length("noticeVersion") BETWEEN 1 AND 100 AND
    char_length("consentTextVersion") BETWEEN 1 AND 100 AND
    (("action" = 'GRANTED' AND "supersedesConsentId" IS NULL) OR
     ("action" = 'REVOKED' AND "supersedesConsentId" IS NOT NULL))
  );

ALTER TABLE "CvImportConfirmation" ADD CONSTRAINT "CvImportConfirmation_revisions"
  CHECK (
    octet_length("idempotencyDigest") = 32 AND octet_length("selectionManifestDigest") = 32 AND
    "draftRevision" >= 0 AND "sourceProfileRevision" >= 0 AND "reviewedProfileRevision" >= 0 AND
    "profileRevisionBefore" >= 0 AND "profileRevisionAfter" = "profileRevisionBefore" + 1 AND
    octet_length("selectionManifest"::text) <= 65536
  );
ALTER TABLE "CvImportConfirmation" ADD CONSTRAINT "CvImportConfirmation_counts"
  CHECK (
    "appliedScalarCount" BETWEEN 0 AND 4 AND
    "appliedExperienceCount" BETWEEN 0 AND 50 AND
    "appliedEducationCount" BETWEEN 0 AND 50 AND
    "appliedSkillCount" BETWEEN 0 AND 50 AND
    "appliedSocialLinkCount" BETWEEN 0 AND 10
  );

CREATE OR REPLACE FUNCTION cv_append_only_guard()
RETURNS trigger AS $$
BEGIN
  IF current_setting('smarthire.cv_retention_mode', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cv_terminal_attempt_guard()
RETURNS trigger AS $$
BEGIN
  IF current_setting('smarthire.cv_retention_mode', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD."status"::text IN ('CLEAN', 'INFECTED', 'INDETERMINATE', 'SUCCEEDED', 'FAILED', 'CANCELLED') THEN
      RAISE EXCEPTION '% terminal attempt is immutable', TG_TABLE_NAME USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."status"::text IN ('CLEAN', 'INFECTED', 'INDETERMINATE', 'SUCCEEDED', 'FAILED', 'CANCELLED')
     AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION '% terminal attempt is immutable', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CvRetryRequest_append_only"
BEFORE UPDATE OR DELETE ON "CvRetryRequest"
FOR EACH ROW EXECUTE FUNCTION cv_append_only_guard();
CREATE TRIGGER "CvProcessingConsent_append_only"
BEFORE UPDATE OR DELETE ON "CvProcessingConsent"
FOR EACH ROW EXECUTE FUNCTION cv_append_only_guard();
CREATE TRIGGER "CvImportConfirmation_append_only"
BEFORE UPDATE OR DELETE ON "CvImportConfirmation"
FOR EACH ROW EXECUTE FUNCTION cv_append_only_guard();
CREATE TRIGGER "CvScanAssessment_terminal_immutable"
BEFORE UPDATE OR DELETE ON "CvScanAssessment"
FOR EACH ROW EXECUTE FUNCTION cv_terminal_attempt_guard();
CREATE TRIGGER "CvExtraction_terminal_immutable"
BEFORE UPDATE OR DELETE ON "CvExtraction"
FOR EACH ROW EXECUTE FUNCTION cv_terminal_attempt_guard();
CREATE TRIGGER "CvParseJob_terminal_immutable"
BEFORE UPDATE OR DELETE ON "CvParseJob"
FOR EACH ROW EXECUTE FUNCTION cv_terminal_attempt_guard();

-- Rollback safety: any compensating migration must remove the six triggers,
-- then their functions, tables in reverse dependency order, and finally the
-- Feature 004 enum types. It must not alter Better Auth session/user ownership,
-- Candidate Profile fields, AuditEvent content, or migrations 001-007.
