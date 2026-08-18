ALTER TYPE "EmailKind" ADD VALUE IF NOT EXISTS 'COMPANY_EMAIL_VERIFY';

CREATE TYPE "BusinessRegistryLookupOutcome" AS ENUM ('MATCHED', 'PARTIAL', 'NOT_FOUND', 'UNAVAILABLE');
CREATE TYPE "CompanyEmailChallengeState" AS ENUM ('PENDING', 'VERIFIED', 'CONSUMED', 'SUPERSEDED', 'EXPIRED');
CREATE TYPE "EmployerApplicantRelationship" AS ENUM ('LEGAL_OWNER', 'AUTHORIZED_EMPLOYEE', 'INVITED_MEMBER', 'EXISTING_OWNER_APPROVAL', 'OTHER');

CREATE TABLE "EmployerVerificationPreparation" (
  "id" TEXT NOT NULL,
  "applicantUserId" TEXT NOT NULL,
  "lookupSnapshotId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "applicantLegalName" TEXT,
  "applicantRegisteredAddress" TEXT,
  "operatingAddressDiffers" BOOLEAN NOT NULL DEFAULT false,
  "operatingAddress" TEXT,
  "companyPhoneE164" TEXT,
  "websiteOrigin" TEXT,
  "relationship" "EmployerApplicantRelationship",
  "currentJobTitle" TEXT,
  "authorityExplanation" TEXT,
  "mismatchExplanation" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "inaccessibleAt" TIMESTAMP(3),
  "deleteAfter" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployerVerificationPreparation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessRegistryLookupSnapshot" (
  "id" TEXT NOT NULL,
  "applicantUserId" TEXT NOT NULL,
  "normalizedTaxIdentifier" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "outcome" "BusinessRegistryLookupOutcome" NOT NULL,
  "registryLegalName" TEXT,
  "registryInternationalName" TEXT,
  "registryShortName" TEXT,
  "registryRegisteredAddress" TEXT,
  "registryEstablishedAt" TIMESTAMP(3),
  "registryLegalStatus" TEXT,
  "registryEntityType" TEXT,
  "registryRepresentativeName" TEXT,
  "responseDigest" TEXT NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedRequestId" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "inaccessibleAt" TIMESTAMP(3),
  "deleteAfter" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessRegistryLookupSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyContactEmailChallenge" (
  "id" TEXT NOT NULL,
  "applicantUserId" TEXT NOT NULL,
  "lookupSnapshotId" TEXT NOT NULL,
  "normalizedTaxIdentifier" TEXT NOT NULL,
  "normalizedEmail" TEXT,
  "emailDigest" TEXT NOT NULL,
  "tokenDigest" TEXT,
  "state" "CompanyEmailChallengeState" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "sensitiveInaccessibleAt" TIMESTAMP(3),
  "sensitiveDeleteAfter" TIMESTAMP(3),
  "metadataDeleteAfter" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyContactEmailChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationBusinessFacts" (
  "requestId" TEXT NOT NULL,
  "lookupSnapshotId" TEXT NOT NULL,
  "applicantLegalName" TEXT NOT NULL,
  "applicantRegisteredAddress" TEXT NOT NULL,
  "operatingAddress" TEXT,
  "companyEmail" TEXT NOT NULL,
  "companyEmailVerifiedAt" TIMESTAMP(3) NOT NULL,
  "companyEmailFreeProvider" BOOLEAN NOT NULL,
  "companyEmailWebsiteDomainMatch" BOOLEAN,
  "emailSignalVersion" TEXT NOT NULL,
  "companyPhoneE164" TEXT NOT NULL,
  "companyPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
  "websiteOrigin" TEXT,
  "relationship" "EmployerApplicantRelationship" NOT NULL,
  "currentJobTitle" TEXT NOT NULL,
  "authorityExplanation" TEXT,
  "legalNameDiffers" BOOLEAN NOT NULL,
  "registeredAddressDiffers" BOOLEAN NOT NULL,
  "mismatchExplanation" TEXT,
  "accuracyDeclaredAt" TIMESTAMP(3) NOT NULL,
  "documentConsentAt" TIMESTAMP(3) NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "normalizationVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationBusinessFacts_pkey" PRIMARY KEY ("requestId")
);

ALTER TABLE "EmailOutbox" ADD COLUMN "companyEmailChallengeId" TEXT;
ALTER TABLE "RecruiterVerificationRequest" ADD COLUMN "submissionIdempotencyKey" TEXT;

CREATE UNIQUE INDEX "EmployerVerificationPreparation_applicantUserId_key" ON "EmployerVerificationPreparation"("applicantUserId");
CREATE UNIQUE INDEX "EmployerVerificationPreparation_lookupSnapshotId_key" ON "EmployerVerificationPreparation"("lookupSnapshotId");
CREATE INDEX "EmployerVerificationPreparation_expiresAt_inaccessibleAt_idx" ON "EmployerVerificationPreparation"("expiresAt", "inaccessibleAt");
CREATE INDEX "EmployerVerificationPreparation_deleteAfter_deletedAt_idx" ON "EmployerVerificationPreparation"("deleteAfter", "deletedAt");
CREATE UNIQUE INDEX "BusinessRegistryLookupSnapshot_acceptedRequestId_key" ON "BusinessRegistryLookupSnapshot"("acceptedRequestId");
CREATE INDEX "BusinessRegistryLookupSnapshot_applicant_tax_expiry_idx" ON "BusinessRegistryLookupSnapshot"("applicantUserId", "normalizedTaxIdentifier", "expiresAt");
CREATE INDEX "BusinessRegistryLookupSnapshot_expiry_acceptance_idx" ON "BusinessRegistryLookupSnapshot"("expiresAt", "acceptedRequestId", "inaccessibleAt");
CREATE INDEX "BusinessRegistryLookupSnapshot_deleteAfter_deletedAt_idx" ON "BusinessRegistryLookupSnapshot"("deleteAfter", "deletedAt");
CREATE UNIQUE INDEX "CompanyContactEmailChallenge_tokenDigest_key" ON "CompanyContactEmailChallenge"("tokenDigest");
CREATE INDEX "CompanyContactEmailChallenge_binding_state_idx" ON "CompanyContactEmailChallenge"("applicantUserId", "lookupSnapshotId", "state");
CREATE INDEX "CompanyContactEmailChallenge_expiresAt_state_idx" ON "CompanyContactEmailChallenge"("expiresAt", "state");
CREATE INDEX "CompanyContactEmailChallenge_sensitiveDeleteAfter_idx" ON "CompanyContactEmailChallenge"("sensitiveDeleteAfter");
CREATE INDEX "CompanyContactEmailChallenge_metadataDeleteAfter_idx" ON "CompanyContactEmailChallenge"("metadataDeleteAfter");
CREATE UNIQUE INDEX "VerificationBusinessFacts_lookupSnapshotId_key" ON "VerificationBusinessFacts"("lookupSnapshotId");
CREATE UNIQUE INDEX "EmailOutbox_companyEmailChallengeId_key" ON "EmailOutbox"("companyEmailChallengeId");
CREATE UNIQUE INDEX "RecruiterVerificationRequest_submissionIdempotencyKey_key" ON "RecruiterVerificationRequest"("submissionIdempotencyKey");
CREATE INDEX "EmailOutbox_companyEmailChallengeId_kind_idx" ON "EmailOutbox"("companyEmailChallengeId", "kind");
ALTER TABLE "EmployerVerificationPreparation" ADD CONSTRAINT "EmployerVerificationPreparation_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployerVerificationPreparation" ADD CONSTRAINT "EmployerVerificationPreparation_lookupSnapshotId_fkey" FOREIGN KEY ("lookupSnapshotId") REFERENCES "BusinessRegistryLookupSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessRegistryLookupSnapshot" ADD CONSTRAINT "BusinessRegistryLookupSnapshot_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessRegistryLookupSnapshot" ADD CONSTRAINT "BusinessRegistryLookupSnapshot_acceptedRequestId_fkey" FOREIGN KEY ("acceptedRequestId") REFERENCES "RecruiterVerificationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyContactEmailChallenge" ADD CONSTRAINT "CompanyContactEmailChallenge_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyContactEmailChallenge" ADD CONSTRAINT "CompanyContactEmailChallenge_lookupSnapshotId_fkey" FOREIGN KEY ("lookupSnapshotId") REFERENCES "BusinessRegistryLookupSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificationBusinessFacts" ADD CONSTRAINT "VerificationBusinessFacts_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RecruiterVerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificationBusinessFacts" ADD CONSTRAINT "VerificationBusinessFacts_lookupSnapshotId_fkey" FOREIGN KEY ("lookupSnapshotId") REFERENCES "BusinessRegistryLookupSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_companyEmailChallengeId_fkey" FOREIGN KEY ("companyEmailChallengeId") REFERENCES "CompanyContactEmailChallenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
