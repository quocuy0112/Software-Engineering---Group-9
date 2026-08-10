-- CreateEnum
CREATE TYPE "AdministratorGrantState" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CompanyVerificationState" AS ENUM ('UNVERIFIED', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RecruiterVerificationState" AS ENUM ('PENDING_CHECKS', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VerificationCheckState" AS ENUM ('PENDING', 'PASS', 'FAIL', 'INDETERMINATE');

-- CreateEnum
CREATE TYPE "VerificationDecisionKind" AS ENUM ('REQUEST_CHANGES', 'APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "CompanyAccessPrerequisiteKind" AS ENUM ('INVITATION', 'OWNER_APPROVAL');

-- CreateEnum
CREATE TYPE "CompanyAccessPrerequisiteState" AS ENUM ('AVAILABLE', 'USED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AdminReasonCategory" AS ENUM ('SECURITY_COMPROMISE', 'POLICY_VIOLATION', 'USER_REQUEST', 'VERIFICATION_FAILURE', 'INCIDENT_RESOLVED', 'ACCESS_CLEANUP', 'OTHER');

-- CreateEnum
CREATE TYPE "SecurityNotificationStatus" AS ENUM ('PENDING', 'RETRYING', 'DELIVERED', 'MANUAL_INTERVENTION_REQUIRED');

-- CreateEnum
CREATE TYPE "SecurityNotificationFailureCategory" AS ENUM ('DESTINATION_REJECTED', 'DESTINATION_DISABLED', 'CONTENT_INVALID', 'POLICY_REFUSED', 'TEMPORARY_UNAVAILABLE', 'ATTEMPTS_EXHAUSTED');

-- CreateEnum
CREATE TYPE "ModerationTargetType" AS ENUM ('JOB', 'COMPANY', 'MEMBERSHIP', 'CANDIDATE');

-- CreateEnum
CREATE TYPE "ModerationReportCategory" AS ENUM ('FRAUD_OR_IMPERSONATION', 'MISLEADING_CONTENT', 'DISCRIMINATION_OR_HARASSMENT', 'ABUSE_OR_THREATS', 'SPAM_OR_DUPLICATE', 'PRIVACY_OR_DATA_MISUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "ModerationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ModerationReportState" AS ENUM ('PENDING_REVIEW', 'RESOLVED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "CompanyMembershipStatus" ADD VALUE 'REMOVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailKind" ADD VALUE 'VERIFICATION_RECEIVED';
ALTER TYPE "EmailKind" ADD VALUE 'VERIFICATION_CHANGES_REQUESTED';
ALTER TYPE "EmailKind" ADD VALUE 'VERIFICATION_APPROVED';
ALTER TYPE "EmailKind" ADD VALUE 'VERIFICATION_REJECTED';
ALTER TYPE "EmailKind" ADD VALUE 'VERIFICATION_CANCELLED';
ALTER TYPE "EmailKind" ADD VALUE 'VERIFICATION_DELAYED';
ALTER TYPE "EmailKind" ADD VALUE 'VERIFICATION_EXPIRED';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "normalizedTaxIdentifier" TEXT,
ADD COLUMN     "verificationInactiveAt" TIMESTAMP(3),
ADD COLUMN     "verificationState" "CompanyVerificationState" NOT NULL DEFAULT 'UNVERIFIED';

-- AlterTable
ALTER TABLE "CompanyMembership" ADD COLUMN     "priorApprovedRole" "CompanyMembershipRole",
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "stateChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "EmailOutbox" ADD COLUMN     "verificationRequestId" TEXT;

-- CreateTable
CREATE TABLE "PlatformAdministratorGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" "AdministratorGrantState" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "stateChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAdministratorGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdministratorSessionPolicy" (
    "grantId" TEXT NOT NULL,
    "designatedSessionId" TEXT,
    "initialTwoFactorAt" TIMESTAMP(3),
    "latestTwoFactorProofAt" TIMESTAMP(3),
    "designationVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdministratorSessionPolicy_pkey" PRIMARY KEY ("grantId")
);

-- CreateTable
CREATE TABLE "CompanyMembershipHistory" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "priorStatus" "CompanyMembershipStatus" NOT NULL,
    "resultingStatus" "CompanyMembershipStatus" NOT NULL,
    "priorRole" "CompanyMembershipRole" NOT NULL,
    "resultingRole" "CompanyMembershipRole" NOT NULL,
    "version" INTEGER NOT NULL,
    "correlationId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMembershipHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAccessPrerequisite" (
    "id" TEXT NOT NULL,
    "kind" "CompanyAccessPrerequisiteKind" NOT NULL,
    "state" "CompanyAccessPrerequisiteState" NOT NULL DEFAULT 'AVAILABLE',
    "requestId" TEXT,
    "applicantUserId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "CompanyMembershipRole" NOT NULL,
    "approvedByOwnerMembershipId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "usedByRequestId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAccessPrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruiterVerificationRequest" (
    "id" TEXT NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "submittedCompanyName" TEXT NOT NULL,
    "normalizedTaxIdentifier" TEXT NOT NULL,
    "targetCompanyId" TEXT,
    "requestedRole" "CompanyMembershipRole" NOT NULL,
    "prerequisiteId" TEXT,
    "state" "RecruiterVerificationState" NOT NULL DEFAULT 'PENDING_CHECKS',
    "currentEvidenceId" TEXT,
    "currentSubmissionVersion" INTEGER NOT NULL DEFAULT 1,
    "resubmissionCount" INTEGER NOT NULL DEFAULT 0,
    "assignedAdminUserId" TEXT,
    "changesRequestedAt" TIMESTAMP(3),
    "delayedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "viewerUnavailableSince" TIMESTAMP(3),
    "viewerEscalatedAt" TIMESTAMP(3),
    "viewerDelayNotifiedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruiterVerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessLicenseEvidence" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "submissionVersion" INTEGER NOT NULL,
    "declaredMediaType" TEXT NOT NULL,
    "detectedMediaType" TEXT,
    "byteSize" INTEGER NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "storageAdapter" TEXT NOT NULL,
    "storageLocator" TEXT NOT NULL,
    "encryptionKeyVersion" INTEGER NOT NULL,
    "iv" TEXT NOT NULL,
    "authenticationTag" TEXT NOT NULL,
    "malwareStatus" "VerificationCheckState" NOT NULL DEFAULT 'PENDING',
    "typeStatus" "VerificationCheckState" NOT NULL DEFAULT 'PENDING',
    "structureStatus" "VerificationCheckState" NOT NULL DEFAULT 'PENDING',
    "previewStatus" "VerificationCheckState" NOT NULL DEFAULT 'PENDING',
    "reviewableAt" TIMESTAMP(3),
    "contentInaccessibleAt" TIMESTAMP(3),
    "deleteAfter" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessLicenseEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationSafetyAttempt" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "malwareStatus" "VerificationCheckState" NOT NULL,
    "typeStatus" "VerificationCheckState" NOT NULL,
    "structureStatus" "VerificationCheckState" NOT NULL,
    "previewStatus" "VerificationCheckState" NOT NULL,
    "policyVersions" JSONB NOT NULL,
    "safeFailureCode" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationSafetyAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationDecisionHistory" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "submissionVersion" INTEGER NOT NULL,
    "actorAdminUserId" TEXT NOT NULL,
    "priorState" "RecruiterVerificationState" NOT NULL,
    "resultingState" "RecruiterVerificationState" NOT NULL,
    "decisionKind" "VerificationDecisionKind" NOT NULL,
    "rejectionCategory" TEXT,
    "approvedRole" "CompanyMembershipRole",
    "result" "AuditResult" NOT NULL,
    "correlationId" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDecisionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationPrivateNote" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorAdminUserId" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationPrivateNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivilegedActionRationale" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authenticationTag" TEXT NOT NULL,
    "encryptionKeyVersion" INTEGER NOT NULL,
    "inaccessibleAt" TIMESTAMP(3) NOT NULL,
    "deleteAfter" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deleteAttempts" INTEGER NOT NULL DEFAULT 0,
    "safeFailureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivilegedActionRationale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminCommandReceipt" (
    "id" TEXT NOT NULL,
    "actorSubjectDigest" TEXT NOT NULL,
    "commandKind" TEXT NOT NULL,
    "targetReference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "normalizedBodyDigest" TEXT NOT NULL,
    "resultCode" TEXT NOT NULL,
    "resultingVersion" INTEGER,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminCommandReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityNotificationWork" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "originatingCorrelationId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadRef" JSONB NOT NULL,
    "status" "SecurityNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "deliveryDeadline" TIMESTAMP(3) NOT NULL,
    "failureCategory" "SecurityNotificationFailureCategory",
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityNotificationWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminDashboardSnapshot" (
    "id" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "stateDefinitionVersion" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminDashboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationReport" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "targetType" "ModerationTargetType" NOT NULL,
    "targetReference" TEXT NOT NULL,
    "companyReference" TEXT,
    "jobReference" TEXT,
    "applicationReference" TEXT,
    "qualifyingRelationship" JSONB NOT NULL,
    "category" "ModerationReportCategory" NOT NULL,
    "normalizedDetail" TEXT,
    "priority" "ModerationPriority" NOT NULL DEFAULT 'NORMAL',
    "state" "ModerationReportState" NOT NULL DEFAULT 'PENDING_REVIEW',
    "assignedAdminUserId" TEXT,
    "unresolvedKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "terminalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationReportHistory" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorAdminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "priorState" "ModerationReportState" NOT NULL,
    "resultingState" "ModerationReportState" NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "enforcementCorrelationId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationReportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationPrivateNote" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "authorAdminUserId" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationPrivateNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformAdministratorGrant_state_expiresAt_idx" ON "PlatformAdministratorGrant"("state", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAdministratorGrant_userId_key" ON "PlatformAdministratorGrant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdministratorSessionPolicy_designatedSessionId_key" ON "AdministratorSessionPolicy"("designatedSessionId");

-- CreateIndex
CREATE INDEX "AdministratorSessionPolicy_latestTwoFactorProofAt_idx" ON "AdministratorSessionPolicy"("latestTwoFactorProofAt");

-- CreateIndex
CREATE INDEX "CompanyMembershipHistory_actorUserId_occurredAt_idx" ON "CompanyMembershipHistory"("actorUserId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMembershipHistory_membershipId_version_key" ON "CompanyMembershipHistory"("membershipId", "version");

-- CreateIndex
CREATE INDEX "CompanyAccessPrerequisite_companyId_applicantUserId_state_idx" ON "CompanyAccessPrerequisite"("companyId", "applicantUserId", "state");

-- CreateIndex
CREATE INDEX "CompanyAccessPrerequisite_requestId_idx" ON "CompanyAccessPrerequisite"("requestId");

-- CreateIndex
CREATE INDEX "RecruiterVerificationRequest_state_createdAt_id_idx" ON "RecruiterVerificationRequest"("state", "createdAt", "id");

-- CreateIndex
CREATE INDEX "RecruiterVerificationRequest_normalizedTaxIdentifier_state_idx" ON "RecruiterVerificationRequest"("normalizedTaxIdentifier", "state");

-- CreateIndex
CREATE INDEX "RecruiterVerificationRequest_applicantUserId_normalizedTaxI_idx" ON "RecruiterVerificationRequest"("applicantUserId", "normalizedTaxIdentifier", "state");

-- CreateIndex
CREATE INDEX "RecruiterVerificationRequest_assignedAdminUserId_state_idx" ON "RecruiterVerificationRequest"("assignedAdminUserId", "state");

-- CreateIndex
CREATE INDEX "BusinessLicenseEvidence_deleteAfter_deletedAt_idx" ON "BusinessLicenseEvidence"("deleteAfter", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessLicenseEvidence_requestId_submissionVersion_key" ON "BusinessLicenseEvidence"("requestId", "submissionVersion");

-- CreateIndex
CREATE INDEX "VerificationSafetyAttempt_leaseExpiresAt_idx" ON "VerificationSafetyAttempt"("leaseExpiresAt");

-- CreateIndex
CREATE INDEX "VerificationSafetyAttempt_requestId_evidenceId_idx" ON "VerificationSafetyAttempt"("requestId", "evidenceId");

-- CreateIndex
CREATE INDEX "VerificationDecisionHistory_requestId_decidedAt_idx" ON "VerificationDecisionHistory"("requestId", "decidedAt");

-- CreateIndex
CREATE INDEX "VerificationDecisionHistory_actorAdminUserId_decidedAt_idx" ON "VerificationDecisionHistory"("actorAdminUserId", "decidedAt");

-- CreateIndex
CREATE INDEX "VerificationPrivateNote_requestId_createdAt_idx" ON "VerificationPrivateNote"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrivilegedActionRationale_correlationId_key" ON "PrivilegedActionRationale"("correlationId");

-- CreateIndex
CREATE INDEX "PrivilegedActionRationale_deleteAfter_deletedAt_idx" ON "PrivilegedActionRationale"("deleteAfter", "deletedAt");

-- CreateIndex
CREATE INDEX "AdminCommandReceipt_correlationId_idx" ON "AdminCommandReceipt"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminCommandReceipt_actorSubjectDigest_idempotencyKey_key" ON "AdminCommandReceipt"("actorSubjectDigest", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityNotificationWork_idempotencyKey_key" ON "SecurityNotificationWork"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SecurityNotificationWork_status_nextAttemptAt_idx" ON "SecurityNotificationWork"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "SecurityNotificationWork_deliveryDeadline_idx" ON "SecurityNotificationWork"("deliveryDeadline");

-- CreateIndex
CREATE INDEX "SecurityNotificationWork_originatingCorrelationId_idx" ON "SecurityNotificationWork"("originatingCorrelationId");

-- CreateIndex
CREATE INDEX "AdminDashboardSnapshot_expiresAt_calculatedAt_idx" ON "AdminDashboardSnapshot"("expiresAt", "calculatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ModerationReport_unresolvedKey_key" ON "ModerationReport"("unresolvedKey");

-- CreateIndex
CREATE INDEX "ModerationReport_state_priority_createdAt_id_idx" ON "ModerationReport"("state", "priority", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ModerationReport_reporterUserId_createdAt_idx" ON "ModerationReport"("reporterUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ModerationReport_targetType_targetReference_idx" ON "ModerationReport"("targetType", "targetReference");

-- CreateIndex
CREATE INDEX "ModerationReportHistory_actorAdminUserId_occurredAt_idx" ON "ModerationReportHistory"("actorAdminUserId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationReportHistory_reportId_resultingVersion_key" ON "ModerationReportHistory"("reportId", "resultingVersion");

-- CreateIndex
CREATE INDEX "ModerationPrivateNote_reportId_createdAt_idx" ON "ModerationPrivateNote"("reportId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Company_normalizedTaxIdentifier_key" ON "Company"("normalizedTaxIdentifier");

-- CreateIndex
CREATE INDEX "EmailOutbox_verificationRequestId_kind_idx" ON "EmailOutbox"("verificationRequestId", "kind");

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "RecruiterVerificationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAdministratorGrant" ADD CONSTRAINT "PlatformAdministratorGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdministratorSessionPolicy" ADD CONSTRAINT "AdministratorSessionPolicy_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "PlatformAdministratorGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdministratorSessionPolicy" ADD CONSTRAINT "AdministratorSessionPolicy_designatedSessionId_fkey" FOREIGN KEY ("designatedSessionId") REFERENCES "session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembershipHistory" ADD CONSTRAINT "CompanyMembershipHistory_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CompanyMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAccessPrerequisite" ADD CONSTRAINT "CompanyAccessPrerequisite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterVerificationRequest" ADD CONSTRAINT "RecruiterVerificationRequest_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterVerificationRequest" ADD CONSTRAINT "RecruiterVerificationRequest_targetCompanyId_fkey" FOREIGN KEY ("targetCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessLicenseEvidence" ADD CONSTRAINT "BusinessLicenseEvidence_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RecruiterVerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationSafetyAttempt" ADD CONSTRAINT "VerificationSafetyAttempt_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RecruiterVerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDecisionHistory" ADD CONSTRAINT "VerificationDecisionHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RecruiterVerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationPrivateNote" ADD CONSTRAINT "VerificationPrivateNote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RecruiterVerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReportHistory" ADD CONSTRAINT "ModerationReportHistory_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ModerationReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationPrivateNote" ADD CONSTRAINT "ModerationPrivateNote_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ModerationReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill retained membership role for all pre-Feature-006 memberships.
UPDATE "CompanyMembership"
SET "priorApprovedRole" = "role"
WHERE "priorApprovedRole" IS NULL;

-- One active verification request per applicant and normalized company tax ID.
CREATE UNIQUE INDEX "RecruiterVerificationRequest_active_applicant_tax_key"
ON "RecruiterVerificationRequest" ("applicantUserId", "normalizedTaxIdentifier")
WHERE "state" IN ('PENDING_CHECKS', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'RESUBMITTED');

ALTER TABLE "RecruiterVerificationRequest"
  ADD CONSTRAINT "RecruiterVerificationRequest_tax_identifier_check"
  CHECK ("normalizedTaxIdentifier" ~ '^[0-9]{10}$'),
  ADD CONSTRAINT "RecruiterVerificationRequest_resubmission_count_check"
  CHECK ("resubmissionCount" BETWEEN 0 AND 3),
  ADD CONSTRAINT "RecruiterVerificationRequest_submission_version_check"
  CHECK ("currentSubmissionVersion" >= 1),
  ADD CONSTRAINT "RecruiterVerificationRequest_version_check"
  CHECK ("version" >= 1);

ALTER TABLE "BusinessLicenseEvidence"
  ADD CONSTRAINT "BusinessLicenseEvidence_byte_size_check"
  CHECK ("byteSize" BETWEEN 1 AND 5000000),
  ADD CONSTRAINT "BusinessLicenseEvidence_submission_version_check"
  CHECK ("submissionVersion" >= 1);

ALTER TABLE "SecurityNotificationWork"
  ADD CONSTRAINT "SecurityNotificationWork_attempt_count_check"
  CHECK ("attemptCount" BETWEEN 0 AND 5);

ALTER TABLE "CompanyMembership"
  ADD CONSTRAINT "CompanyMembership_removed_timestamp_check"
  CHECK (("status" = 'REMOVED') = ("removedAt" IS NOT NULL));

-- Preserve legacy job reports in the unified private moderation authority.
INSERT INTO "ModerationReport" (
  "id", "reporterUserId", "targetType", "targetReference", "jobReference",
  "qualifyingRelationship", "category", "normalizedDetail", "priority",
  "state", "unresolvedKey", "version", "terminalAt", "createdAt", "updatedAt"
)
SELECT
  'legacy-job-report:' || jr."id",
  jr."reporterUserId",
  'JOB'::"ModerationTargetType",
  jr."jobPostingId",
  jr."jobPostingId",
  jsonb_build_object('kind', 'LEGACY_PUBLIC_JOB_REPORT', 'jobReportId', jr."id"),
  CASE jr."reason"::text
    WHEN 'FRAUD' THEN 'FRAUD_OR_IMPERSONATION'::"ModerationReportCategory"
    WHEN 'MISLEADING' THEN 'MISLEADING_CONTENT'::"ModerationReportCategory"
    WHEN 'DUPLICATE' THEN 'SPAM_OR_DUPLICATE'::"ModerationReportCategory"
    WHEN 'DISCRIMINATORY' THEN 'DISCRIMINATION_OR_HARASSMENT'::"ModerationReportCategory"
    WHEN 'INAPPROPRIATE' THEN 'ABUSE_OR_THREATS'::"ModerationReportCategory"
    ELSE 'OTHER'::"ModerationReportCategory"
  END,
  jr."details",
  'NORMAL'::"ModerationPriority",
  jr."status"::text::"ModerationReportState",
  CASE WHEN jr."status"::text = 'PENDING_REVIEW' THEN 'legacy:' || jr."id" ELSE NULL END,
  1,
  jr."resolvedAt",
  jr."createdAt",
  jr."updatedAt"
FROM "JobReport" jr
ON CONFLICT ("id") DO NOTHING;
