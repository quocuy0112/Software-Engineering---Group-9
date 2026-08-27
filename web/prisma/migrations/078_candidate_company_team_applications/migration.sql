-- Candidate Company discovery and Owner-controlled team applications.
CREATE TYPE "TeamOpportunityState" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "TeamApplicationStatus" AS ENUM (
  'SUBMITTED',
  'VIEWED',
  'REJECTED',
  'INVITATION_SENT',
  'WITHDRAWN',
  'JOINED'
);

ALTER TABLE "Company" ADD COLUMN "foundedYear" INTEGER;

CREATE TABLE "TeamOpportunity" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "role" "CompanyMembershipRole" NOT NULL,
  "state" "TeamOpportunityState" NOT NULL DEFAULT 'OPEN',
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamOpportunity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamOpportunity_role_supported" CHECK ("role" IN ('HR_MANAGER', 'RECRUITER'))
);

CREATE TABLE "TeamApplication" (
  "id" TEXT NOT NULL,
  "candidateUserId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "teamOpportunityId" TEXT NOT NULL,
  "appliedRole" "CompanyMembershipRole" NOT NULL,
  "applicationEmail" TEXT NOT NULL,
  "cvDisplayName" TEXT NOT NULL,
  "cvFileName" TEXT NOT NULL,
  "cvMimeType" TEXT NOT NULL,
  "cvByteSize" INTEGER NOT NULL,
  "cvStorageKey" TEXT NOT NULL,
  "cvChecksumSha256" CHAR(64) NOT NULL,
  "activeKey" TEXT,
  "status" "TeamApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "rejectionReason" VARCHAR(2000),
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ownerFirstViewedAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "joinedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "cvDeleteAfter" TIMESTAMP(3),
  "cvDeletedAt" TIMESTAMP(3),
  "cvDeletionFailureCode" VARCHAR(80),
  "decidedByUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamApplication_role_supported" CHECK ("appliedRole" IN ('HR_MANAGER', 'RECRUITER')),
  CONSTRAINT "TeamApplication_cv_size_supported" CHECK ("cvByteSize" > 0 AND "cvByteSize" <= 5000000)
);

ALTER TABLE "CompanyInvitation" ADD COLUMN "teamApplicationId" TEXT;

CREATE UNIQUE INDEX "TeamOpportunity_companyId_role_key"
  ON "TeamOpportunity"("companyId", "role");
CREATE INDEX "TeamOpportunity_companyId_state_role_idx"
  ON "TeamOpportunity"("companyId", "state", "role");

CREATE UNIQUE INDEX "TeamApplication_cvStorageKey_key"
  ON "TeamApplication"("cvStorageKey");
CREATE UNIQUE INDEX "TeamApplication_activeKey_key"
  ON "TeamApplication"("activeKey");
CREATE INDEX "TeamApplication_companyId_status_submittedAt_idx"
  ON "TeamApplication"("companyId", "status", "submittedAt");
CREATE INDEX "TeamApplication_candidateUserId_status_submittedAt_idx"
  ON "TeamApplication"("candidateUserId", "status", "submittedAt");
CREATE INDEX "TeamApplication_teamOpportunityId_status_idx"
  ON "TeamApplication"("teamOpportunityId", "status");
CREATE UNIQUE INDEX "CompanyInvitation_teamApplicationId_key"
  ON "CompanyInvitation"("teamApplicationId");

ALTER TABLE "TeamOpportunity"
  ADD CONSTRAINT "TeamOpportunity_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamApplication"
  ADD CONSTRAINT "TeamApplication_candidateUserId_fkey"
  FOREIGN KEY ("candidateUserId") REFERENCES "CandidateIdentity"("userId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TeamApplication_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TeamApplication_teamOpportunityId_fkey"
  FOREIGN KEY ("teamOpportunityId") REFERENCES "TeamOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TeamApplication_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyInvitation"
  ADD CONSTRAINT "CompanyInvitation_teamApplicationId_fkey"
  FOREIGN KEY ("teamApplicationId") REFERENCES "TeamApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
