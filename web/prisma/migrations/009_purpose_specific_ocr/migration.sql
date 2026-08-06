-- CreateEnum
CREATE TYPE "OcrProcessingPurpose" AS ENUM ('CV_IMPORT', 'JOB_IMAGE_SEARCH');

-- CreateEnum
CREATE TYPE "OcrAttemptStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'PARTIAL_REVIEW_REQUIRED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OcrUnitKind" AS ENUM ('PDF_PAGE', 'DOCX_BODY_IMAGE', 'SEARCH_IMAGE');

-- CreateEnum
CREATE TYPE "OcrUnitStatus" AS ENUM ('NATIVE_SUFFICIENT', 'OCR_SUCCEEDED', 'NON_TEXT', 'LOW_CONFIDENCE', 'CONFLICT', 'DEDUPLICATED', 'EXCLUDED', 'UNSUPPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "OcrSourceMethod" AS ENUM ('NATIVE', 'OCR', 'NATIVE_AND_OCR', 'NONE');

-- CreateEnum
CREATE TYPE "OcrAnchorQuality" AS ENUM ('EXACT', 'APPROXIMATE', 'PAGE_ONLY', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "SearchActorClass" AS ENUM ('VISITOR', 'AUTHENTICATED');

-- CreateEnum
CREATE TYPE "SearchImageStatus" AS ENUM ('AWAITING_CONTENT', 'SCAN_QUEUED', 'SCANNING', 'DECODE_QUEUED', 'DECODING', 'OCR_QUEUED', 'OCR_PROCESSING', 'AWAITING_CONSENT', 'INTERPRET_QUEUED', 'INTERPRETING', 'RESULT_READY', 'FALLBACK_READY', 'VALIDATION_FAILED', 'INFECTED', 'SCAN_FAILED', 'DECODE_FAILED', 'OCR_FAILED', 'INTERPRET_FAILED', 'CONSUMED', 'CANCELLED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "SearchArtifactKind" AS ENUM ('SOURCE_IMAGE', 'NORMALIZED_IMAGE', 'OCR_TEXT', 'VALIDATED_INTENT');

-- CreateEnum
CREATE TYPE "SearchArtifactStatus" AS ENUM ('QUARANTINED', 'AVAILABLE', 'DELETE_PENDING', 'DELETING', 'DELETED', 'DELETE_FAILED');

-- CreateEnum
CREATE TYPE "SearchScanStatus" AS ENUM ('QUEUED', 'PROCESSING', 'CLEAN', 'INFECTED', 'INDETERMINATE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SearchDecodeStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SearchInterpreterClass" AS ENUM ('DETERMINISTIC_INTERNAL', 'EXTERNAL_OPENAI');

-- CreateEnum
CREATE TYPE "SearchIntentStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FALLBACK_READY', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SearchResultKind" AS ENUM ('VALIDATED_INTENT', 'OCR_TEXT_FALLBACK');

-- CreateEnum
CREATE TYPE "SearchConsentAction" AS ENUM ('GRANTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ImageSearchAdmissionSubject" AS ENUM ('SOURCE_IP', 'BROWSER', 'ACCOUNT');

-- AlterTable
ALTER TABLE "CvExtraction" ADD COLUMN     "accountedUnitCount" INTEGER,
ADD COLUMN     "confidencePolicyVersion" TEXT,
ADD COLUMN     "conflictUnitCount" INTEGER,
ADD COLUMN     "deduplicationPolicyVersion" TEXT,
ADD COLUMN     "eligibilityPolicyVersion" TEXT,
ADD COLUMN     "lowConfidenceUnitCount" INTEGER,
ADD COLUMN     "nativeSegmentCount" INTEGER,
ADD COLUMN     "ocrSegmentCount" INTEGER,
ADD COLUMN     "segmentSchemaVersion" TEXT;

-- CreateTable
CREATE TABLE "OcrProcessingAttempt" (
    "id" TEXT NOT NULL,
    "purpose" "OcrProcessingPurpose" NOT NULL,
    "cvExtractionId" TEXT,
    "searchQueryId" TEXT,
    "status" "OcrAttemptStatus" NOT NULL DEFAULT 'QUEUED',
    "engineName" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "modelSha256" BYTEA NOT NULL,
    "runtimeName" TEXT NOT NULL,
    "runtimeVersion" TEXT NOT NULL,
    "eligibilityPolicyVersion" TEXT,
    "confidencePolicyVersion" TEXT NOT NULL,
    "inputUnitCount" INTEGER NOT NULL,
    "succeededUnitCount" INTEGER NOT NULL DEFAULT 0,
    "reviewUnitCount" INTEGER NOT NULL DEFAULT 0,
    "failedUnitCount" INTEGER NOT NULL DEFAULT 0,
    "outputLineCount" INTEGER,
    "outputUtf8Bytes" INTEGER,
    "failureCode" TEXT,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcrProcessingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrUnitOutcome" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "unitKey" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "kind" "OcrUnitKind" NOT NULL,
    "status" "OcrUnitStatus" NOT NULL,
    "sourceMethod" "OcrSourceMethod" NOT NULL,
    "pageNumber" INTEGER,
    "bodyOrdinal" INTEGER,
    "imageOrdinal" INTEGER,
    "anchorQuality" "OcrAnchorQuality" NOT NULL,
    "averageConfidence" DECIMAL(5,4),
    "minimumConfidence" DECIMAL(5,4),
    "recognizedCharacterCount" INTEGER NOT NULL DEFAULT 0,
    "segmentCount" INTEGER NOT NULL DEFAULT 0,
    "deduplicatedSegmentCount" INTEGER NOT NULL DEFAULT 0,
    "materialConflict" BOOLEAN NOT NULL DEFAULT false,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcrUnitOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchImageQuery" (
    "id" TEXT NOT NULL,
    "actorClass" "SearchActorClass" NOT NULL,
    "accountId" TEXT,
    "visitorSubjectDigest" BYTEA,
    "visitorCapabilityDigest" BYTEA,
    "capabilityKeyVersion" INTEGER,
    "status" "SearchImageStatus" NOT NULL DEFAULT 'AWAITING_CONTENT',
    "interpreterClass" "SearchInterpreterClass" NOT NULL,
    "declaredExtension" TEXT NOT NULL,
    "declaredMediaType" TEXT NOT NULL,
    "declaredBytes" INTEGER NOT NULL,
    "actualBytes" INTEGER,
    "sourceSha256" BYTEA,
    "idempotencyDigest" BYTEA NOT NULL,
    "createBindingDigest" BYTEA NOT NULL,
    "failureCode" TEXT,
    "resultKind" "SearchResultKind",
    "admittedAt" TIMESTAMP(3) NOT NULL,
    "contentReceivedAt" TIMESTAMP(3),
    "resultReadyAt" TIMESTAMP(3),
    "resultConsumedAt" TIMESTAMP(3),
    "contentInaccessibleAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deleteBy" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchImageQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchStoredArtifact" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "kind" "SearchArtifactKind" NOT NULL,
    "status" "SearchArtifactStatus" NOT NULL DEFAULT 'QUARANTINED',
    "storageAdapter" TEXT NOT NULL,
    "storageLocator" TEXT,
    "encryptionKeyVersion" INTEGER,
    "encryptionIv" BYTEA,
    "authenticationTag" BYTEA,
    "plaintextBytes" INTEGER NOT NULL,
    "ciphertextBytes" INTEGER NOT NULL,
    "plaintextSha256" BYTEA NOT NULL,
    "availableAt" TIMESTAMP(3),
    "contentInaccessibleAt" TIMESTAMP(3),
    "deleteAfter" TIMESTAMP(3),
    "deleteBy" TIMESTAMP(3) NOT NULL,
    "deleteLeaseOwner" TEXT,
    "deleteLeaseExpiresAt" TIMESTAMP(3),
    "deleteAttempts" INTEGER NOT NULL DEFAULT 0,
    "deleteFailureCode" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchStoredArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchScanAssessment" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "sourceArtifactId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "SearchScanStatus" NOT NULL DEFAULT 'QUEUED',
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

    CONSTRAINT "SearchScanAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchImageDecodeAttempt" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "sourceArtifactId" TEXT NOT NULL,
    "scanAssessmentId" TEXT NOT NULL,
    "normalizedArtifactId" TEXT,
    "attemptNumber" INTEGER NOT NULL,
    "status" "SearchDecodeStatus" NOT NULL DEFAULT 'QUEUED',
    "normalizerName" TEXT,
    "normalizerVersion" TEXT,
    "rulesVersion" TEXT,
    "detectedFormat" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "decodedPixels" INTEGER,
    "frameCount" INTEGER,
    "metadataRemoved" BOOLEAN,
    "failureCode" TEXT,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchImageDecodeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchIntentAttempt" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "ocrAttemptId" TEXT NOT NULL,
    "ocrTextArtifactId" TEXT NOT NULL,
    "resultArtifactId" TEXT,
    "consentEventId" TEXT,
    "attemptNumber" INTEGER NOT NULL,
    "status" "SearchIntentStatus" NOT NULL DEFAULT 'QUEUED',
    "interpreterClass" "SearchInterpreterClass" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "purposeVersion" TEXT NOT NULL,
    "inputVersion" TEXT NOT NULL,
    "instructionVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "selectionPolicyVersion" TEXT NOT NULL,
    "proposalCount" INTEGER,
    "autoSelectedCount" INTEGER,
    "suggestedCount" INTEGER,
    "discardedCount" INTEGER,
    "providerRequestIdHmac" BYTEA,
    "failureCode" TEXT,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchIntentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchProcessingConsent" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "accountId" TEXT,
    "actorClass" "SearchActorClass" NOT NULL,
    "action" "SearchConsentAction" NOT NULL,
    "supersedesConsentId" TEXT,
    "provider" TEXT NOT NULL,
    "interpreterClass" "SearchInterpreterClass" NOT NULL,
    "model" TEXT NOT NULL,
    "purposeVersion" TEXT NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "consentTextVersion" TEXT NOT NULL,
    "retentionDisclosureVersion" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchProcessingConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageSearchAdmissionEvent" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "subjectKind" "ImageSearchAdmissionSubject" NOT NULL,
    "subjectDigest" BYTEA NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "admittedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageSearchAdmissionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OcrProcessingAttempt_cvExtractionId_key" ON "OcrProcessingAttempt"("cvExtractionId");

-- CreateIndex
CREATE UNIQUE INDEX "OcrProcessingAttempt_searchQueryId_key" ON "OcrProcessingAttempt"("searchQueryId");

-- CreateIndex
CREATE INDEX "OcrProcessingAttempt_claim_idx" ON "OcrProcessingAttempt"("status", "leaseExpiresAt", "createdAt");

-- CreateIndex
CREATE INDEX "OcrProcessingAttempt_purpose_createdAt_idx" ON "OcrProcessingAttempt"("purpose", "createdAt");

-- CreateIndex
CREATE INDEX "OcrUnitOutcome_attemptId_status_ordinal_idx" ON "OcrUnitOutcome"("attemptId", "status", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "OcrUnitOutcome_attemptId_unitKey_key" ON "OcrUnitOutcome"("attemptId", "unitKey");

-- CreateIndex
CREATE UNIQUE INDEX "OcrUnitOutcome_attemptId_ordinal_key" ON "OcrUnitOutcome"("attemptId", "ordinal");

-- CreateIndex
CREATE INDEX "SearchImageQuery_work_idx" ON "SearchImageQuery"("status", "deleteBy", "id");

-- CreateIndex
CREATE INDEX "SearchImageQuery_accountId_createdAt_idx" ON "SearchImageQuery"("accountId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SearchImageQuery_reconcile_idx" ON "SearchImageQuery"("contentInaccessibleAt", "deletedAt");

-- CreateIndex
CREATE INDEX "SearchStoredArtifact_delete_claim_idx" ON "SearchStoredArtifact"("status", "deleteAfter", "deleteBy", "deleteLeaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SearchStoredArtifact_queryId_kind_key" ON "SearchStoredArtifact"("queryId", "kind");

-- CreateIndex
CREATE INDEX "SearchScanAssessment_claim_idx" ON "SearchScanAssessment"("status", "leaseExpiresAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SearchScanAssessment_queryId_attemptNumber_key" ON "SearchScanAssessment"("queryId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SearchImageDecodeAttempt_normalizedArtifactId_key" ON "SearchImageDecodeAttempt"("normalizedArtifactId");

-- CreateIndex
CREATE INDEX "SearchImageDecodeAttempt_claim_idx" ON "SearchImageDecodeAttempt"("status", "leaseExpiresAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SearchImageDecodeAttempt_queryId_attemptNumber_key" ON "SearchImageDecodeAttempt"("queryId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SearchIntentAttempt_ocrAttemptId_key" ON "SearchIntentAttempt"("ocrAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchIntentAttempt_resultArtifactId_key" ON "SearchIntentAttempt"("resultArtifactId");

-- CreateIndex
CREATE INDEX "SearchIntentAttempt_claim_idx" ON "SearchIntentAttempt"("status", "leaseExpiresAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SearchIntentAttempt_queryId_attemptNumber_key" ON "SearchIntentAttempt"("queryId", "attemptNumber");

-- CreateIndex
CREATE INDEX "SearchProcessingConsent_queryId_occurredAt_idx" ON "SearchProcessingConsent"("queryId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "SearchProcessingConsent_accountId_occurredAt_idx" ON "SearchProcessingConsent"("accountId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "SearchProcessingConsent_supersedesConsentId_idx" ON "SearchProcessingConsent"("supersedesConsentId");

-- CreateIndex
CREATE INDEX "ImageSearchAdmissionEvent_subject_window_idx" ON "ImageSearchAdmissionEvent"("subjectKind", "subjectDigest", "admittedAt");

-- CreateIndex
CREATE INDEX "ImageSearchAdmissionEvent_expiresAt_idx" ON "ImageSearchAdmissionEvent"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImageSearchAdmissionEvent_queryId_subjectKind_key" ON "ImageSearchAdmissionEvent"("queryId", "subjectKind");

-- AddForeignKey
ALTER TABLE "OcrProcessingAttempt" ADD CONSTRAINT "OcrProcessingAttempt_cvExtractionId_fkey" FOREIGN KEY ("cvExtractionId") REFERENCES "CvExtraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrProcessingAttempt" ADD CONSTRAINT "OcrProcessingAttempt_searchQueryId_fkey" FOREIGN KEY ("searchQueryId") REFERENCES "SearchImageQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrUnitOutcome" ADD CONSTRAINT "OcrUnitOutcome_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "OcrProcessingAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchImageQuery" ADD CONSTRAINT "SearchImageQuery_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchStoredArtifact" ADD CONSTRAINT "SearchStoredArtifact_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "SearchImageQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchScanAssessment" ADD CONSTRAINT "SearchScanAssessment_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "SearchImageQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchScanAssessment" ADD CONSTRAINT "SearchScanAssessment_sourceArtifactId_fkey" FOREIGN KEY ("sourceArtifactId") REFERENCES "SearchStoredArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchImageDecodeAttempt" ADD CONSTRAINT "SearchImageDecodeAttempt_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "SearchImageQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchImageDecodeAttempt" ADD CONSTRAINT "SearchImageDecodeAttempt_sourceArtifactId_fkey" FOREIGN KEY ("sourceArtifactId") REFERENCES "SearchStoredArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchImageDecodeAttempt" ADD CONSTRAINT "SearchImageDecodeAttempt_scanAssessmentId_fkey" FOREIGN KEY ("scanAssessmentId") REFERENCES "SearchScanAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchImageDecodeAttempt" ADD CONSTRAINT "SearchImageDecodeAttempt_normalizedArtifactId_fkey" FOREIGN KEY ("normalizedArtifactId") REFERENCES "SearchStoredArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchIntentAttempt" ADD CONSTRAINT "SearchIntentAttempt_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "SearchImageQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchIntentAttempt" ADD CONSTRAINT "SearchIntentAttempt_ocrAttemptId_fkey" FOREIGN KEY ("ocrAttemptId") REFERENCES "OcrProcessingAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchIntentAttempt" ADD CONSTRAINT "SearchIntentAttempt_ocrTextArtifactId_fkey" FOREIGN KEY ("ocrTextArtifactId") REFERENCES "SearchStoredArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchIntentAttempt" ADD CONSTRAINT "SearchIntentAttempt_resultArtifactId_fkey" FOREIGN KEY ("resultArtifactId") REFERENCES "SearchStoredArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchIntentAttempt" ADD CONSTRAINT "SearchIntentAttempt_consentEventId_fkey" FOREIGN KEY ("consentEventId") REFERENCES "SearchProcessingConsent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchProcessingConsent" ADD CONSTRAINT "SearchProcessingConsent_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "SearchImageQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchProcessingConsent" ADD CONSTRAINT "SearchProcessingConsent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchProcessingConsent" ADD CONSTRAINT "SearchProcessingConsent_supersedesConsentId_fkey" FOREIGN KEY ("supersedesConsentId") REFERENCES "SearchProcessingConsent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageSearchAdmissionEvent" ADD CONSTRAINT "ImageSearchAdmissionEvent_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "SearchImageQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Feature 005 domain invariants. These constraints intentionally duplicate
-- service checks so malformed, stale, or concurrent writes fail closed.
ALTER TABLE "OcrProcessingAttempt"
  ADD CONSTRAINT "OcrProcessingAttempt_parent_purpose" CHECK (
    ("purpose" = 'CV_IMPORT' AND "cvExtractionId" IS NOT NULL AND "searchQueryId" IS NULL AND "eligibilityPolicyVersion" IS NOT NULL)
    OR
    ("purpose" = 'JOB_IMAGE_SEARCH' AND "cvExtractionId" IS NULL AND "searchQueryId" IS NOT NULL AND "eligibilityPolicyVersion" IS NULL AND "inputUnitCount" = 1)
  ),
  ADD CONSTRAINT "OcrProcessingAttempt_counts" CHECK (
    "inputUnitCount" >= 1
    AND "succeededUnitCount" >= 0
    AND "reviewUnitCount" >= 0
    AND "failedUnitCount" >= 0
    AND "succeededUnitCount" + "reviewUnitCount" + "failedUnitCount" <= "inputUnitCount"
    AND ("outputLineCount" IS NULL OR "outputLineCount" >= 0)
    AND ("outputUtf8Bytes" IS NULL OR "outputUtf8Bytes" >= 0)
    AND (("leaseOwner" IS NULL) = ("leaseExpiresAt" IS NULL))
    AND ("status" NOT IN ('SUCCEEDED', 'PARTIAL_REVIEW_REQUIRED', 'FAILED', 'CANCELLED') OR "leaseOwner" IS NULL)
  );

ALTER TABLE "OcrUnitOutcome"
  ADD CONSTRAINT "OcrUnitOutcome_location" CHECK (
    "ordinal" >= 0
    AND (
      ("kind" = 'PDF_PAGE' AND "pageNumber" > 0 AND "bodyOrdinal" IS NULL AND "imageOrdinal" IS NULL)
      OR
      ("kind" = 'DOCX_BODY_IMAGE' AND "pageNumber" IS NULL AND "bodyOrdinal" >= 0 AND "imageOrdinal" >= 0)
      OR
      ("kind" = 'SEARCH_IMAGE' AND "ordinal" = 0 AND "pageNumber" IS NULL AND "bodyOrdinal" IS NULL AND "imageOrdinal" IS NULL)
    )
    AND ("averageConfidence" IS NULL OR "averageConfidence" BETWEEN 0 AND 1)
    AND ("minimumConfidence" IS NULL OR "minimumConfidence" BETWEEN 0 AND 1)
    AND "recognizedCharacterCount" >= 0
    AND "segmentCount" >= 0
    AND "deduplicatedSegmentCount" BETWEEN 0 AND "segmentCount"
  );

ALTER TABLE "SearchImageQuery"
  ADD CONSTRAINT "SearchImageQuery_actor" CHECK (
    ("actorClass" = 'AUTHENTICATED' AND "accountId" IS NOT NULL AND "visitorSubjectDigest" IS NULL AND "visitorCapabilityDigest" IS NULL AND "capabilityKeyVersion" IS NULL)
    OR
    ("actorClass" = 'VISITOR' AND "accountId" IS NULL AND "visitorSubjectDigest" IS NOT NULL AND "visitorCapabilityDigest" IS NOT NULL AND "capabilityKeyVersion" > 0)
  ),
  ADD CONSTRAINT "SearchImageQuery_media" CHECK (
    "declaredBytes" BETWEEN 1 AND 5000000
    AND ("actualBytes" IS NULL OR "actualBytes" = "declaredBytes")
    AND (
      ("declaredExtension" = 'png' AND "declaredMediaType" = 'image/png')
      OR
      ("declaredExtension" IN ('jpg', 'jpeg') AND "declaredMediaType" = 'image/jpeg')
    )
  ),
  ADD CONSTRAINT "SearchImageQuery_deadline" CHECK (
    "expiresAt" = "admittedAt" + INTERVAL '15 minutes'
    AND "deleteBy" = "admittedAt" + INTERVAL '15 minutes'
  ),
  ADD CONSTRAINT "SearchImageQuery_result" CHECK (
    ("status" NOT IN ('RESULT_READY', 'FALLBACK_READY', 'CONSUMED') OR ("resultKind" IS NOT NULL AND "resultReadyAt" IS NOT NULL))
    AND ("status" <> 'CONSUMED' OR "resultConsumedAt" IS NOT NULL)
    AND ("status" NOT IN ('CONSUMED', 'CANCELLED', 'EXPIRED', 'DELETED') OR "contentInaccessibleAt" IS NOT NULL)
  );

ALTER TABLE "SearchStoredArtifact"
  ADD CONSTRAINT "SearchStoredArtifact_envelope" CHECK (
    (("deleteLeaseOwner" IS NULL) = ("deleteLeaseExpiresAt" IS NULL))
    AND "deleteAttempts" >= 0
    AND ("deleteAfter" IS NULL OR "deleteAfter" <= "deleteBy")
    AND (
      ("status" = 'DELETED' AND "storageLocator" IS NULL AND "encryptionKeyVersion" IS NULL AND "encryptionIv" IS NULL AND "authenticationTag" IS NULL AND "deletedAt" IS NOT NULL)
      OR
      ("status" <> 'DELETED' AND "storageLocator" IS NOT NULL AND "encryptionKeyVersion" > 0 AND "encryptionIv" IS NOT NULL AND "authenticationTag" IS NOT NULL AND "deletedAt" IS NULL)
    )
    AND ("status" <> 'AVAILABLE' OR "availableAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "SearchStoredArtifact_limits" CHECK (
    "plaintextBytes" >= 0
    AND "ciphertextBytes" >= 0
    AND CASE "kind"
      WHEN 'SOURCE_IMAGE' THEN "plaintextBytes" <= 5000000
      WHEN 'NORMALIZED_IMAGE' THEN "plaintextBytes" <= 26214400
      WHEN 'OCR_TEXT' THEN "plaintextBytes" <= 32768
      WHEN 'VALIDATED_INTENT' THEN "plaintextBytes" <= 65536
      ELSE false
    END
  );

ALTER TABLE "SearchScanAssessment"
  ADD CONSTRAINT "SearchScanAssessment_attempt" CHECK (
    "attemptNumber" >= 1
    AND (("leaseOwner" IS NULL) = ("leaseExpiresAt" IS NULL))
    AND ("status" NOT IN ('CLEAN', 'INFECTED', 'INDETERMINATE', 'CANCELLED') OR "leaseOwner" IS NULL)
  );

ALTER TABLE "SearchImageDecodeAttempt"
  ADD CONSTRAINT "SearchImageDecodeAttempt_success" CHECK (
    "attemptNumber" >= 1
    AND (("leaseOwner" IS NULL) = ("leaseExpiresAt" IS NULL))
    AND ("status" NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED') OR "leaseOwner" IS NULL)
    AND (
      "status" <> 'SUCCEEDED'
      OR (
        "normalizedArtifactId" IS NOT NULL
        AND "detectedFormat" IN ('png', 'jpeg')
        AND "width" > 0 AND "height" > 0
        AND "decodedPixels" BETWEEN 1 AND 20000000
        AND "frameCount" = 1
        AND "metadataRemoved" = true
      )
    )
  );

ALTER TABLE "SearchIntentAttempt"
  ADD CONSTRAINT "SearchIntentAttempt_counts" CHECK (
    "attemptNumber" >= 1
    AND (("leaseOwner" IS NULL) = ("leaseExpiresAt" IS NULL))
    AND ("status" NOT IN ('SUCCEEDED', 'FALLBACK_READY', 'FAILED', 'CANCELLED') OR "leaseOwner" IS NULL)
    AND ("proposalCount" IS NULL OR "proposalCount" BETWEEN 0 AND 20)
    AND ("autoSelectedCount" IS NULL OR ("autoSelectedCount" >= 0 AND "proposalCount" IS NOT NULL AND "autoSelectedCount" <= "proposalCount"))
    AND ("suggestedCount" IS NULL OR ("suggestedCount" >= 0 AND "proposalCount" IS NOT NULL AND "suggestedCount" <= "proposalCount"))
    AND ("discardedCount" IS NULL OR "discardedCount" >= 0)
    AND ("interpreterClass" <> 'EXTERNAL_OPENAI' OR "consentEventId" IS NOT NULL)
    AND ("status" <> 'SUCCEEDED' OR "resultArtifactId" IS NOT NULL)
    AND ("status" <> 'FALLBACK_READY' OR "resultArtifactId" IS NULL)
  );

ALTER TABLE "ImageSearchAdmissionEvent"
  ADD CONSTRAINT "ImageSearchAdmissionEvent_window" CHECK (
    "keyVersion" > 0 AND "expiresAt" = "admittedAt" + INTERVAL '65 minutes'
  );

CREATE UNIQUE INDEX "SearchImageQuery_account_idempotency_idx"
  ON "SearchImageQuery" ("accountId", "idempotencyDigest")
  WHERE "accountId" IS NOT NULL;
CREATE UNIQUE INDEX "SearchImageQuery_visitor_idempotency_idx"
  ON "SearchImageQuery" ("visitorSubjectDigest", "idempotencyDigest")
  WHERE "visitorSubjectDigest" IS NOT NULL;
CREATE UNIQUE INDEX "SearchStoredArtifact_live_locator_idx"
  ON "SearchStoredArtifact" ("storageLocator")
  WHERE "storageLocator" IS NOT NULL;
CREATE UNIQUE INDEX "SearchScanAssessment_one_active_idx"
  ON "SearchScanAssessment" ("queryId")
  WHERE "status" IN ('QUEUED', 'PROCESSING');
CREATE UNIQUE INDEX "SearchImageDecodeAttempt_one_active_idx"
  ON "SearchImageDecodeAttempt" ("queryId")
  WHERE "status" IN ('QUEUED', 'PROCESSING');
CREATE UNIQUE INDEX "SearchIntentAttempt_one_active_idx"
  ON "SearchIntentAttempt" ("queryId")
  WHERE "status" IN ('QUEUED', 'PROCESSING');

CREATE OR REPLACE FUNCTION search_image_query_deadline_guard()
RETURNS trigger AS $$
BEGIN
  IF NEW."deleteBy" IS DISTINCT FROM OLD."deleteBy" OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt" THEN
    RAISE EXCEPTION 'search image query deadline is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SearchImageQuery_deadline_immutable"
BEFORE UPDATE ON "SearchImageQuery"
FOR EACH ROW EXECUTE FUNCTION search_image_query_deadline_guard();

CREATE OR REPLACE FUNCTION search_artifact_deadline_guard()
RETURNS trigger AS $$
DECLARE parent_deadline TIMESTAMP(3);
BEGIN
  SELECT "deleteBy" INTO parent_deadline FROM "SearchImageQuery" WHERE "id" = NEW."queryId";
  IF parent_deadline IS NULL OR NEW."deleteBy" IS DISTINCT FROM parent_deadline THEN
    RAISE EXCEPTION 'search artifact deadline must equal query deadline' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."deleteBy" IS DISTINCT FROM OLD."deleteBy" THEN
    RAISE EXCEPTION 'search artifact deadline is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SearchStoredArtifact_deadline_immutable"
BEFORE INSERT OR UPDATE ON "SearchStoredArtifact"
FOR EACH ROW EXECUTE FUNCTION search_artifact_deadline_guard();

CREATE OR REPLACE FUNCTION search_append_only_guard()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SearchProcessingConsent_append_only"
BEFORE UPDATE ON "SearchProcessingConsent"
FOR EACH ROW EXECUTE FUNCTION search_append_only_guard();
CREATE TRIGGER "ImageSearchAdmissionEvent_append_only"
BEFORE UPDATE ON "ImageSearchAdmissionEvent"
FOR EACH ROW EXECUTE FUNCTION search_append_only_guard();

-- Rollback safety: this migration is deliberately additive and forward-only.
-- Before a future cleanup migration, drain every Feature 005 lease, make all
-- content inaccessible, verify physical deletion, and preserve only the
-- content-free evidence required by the approved retention policy.
