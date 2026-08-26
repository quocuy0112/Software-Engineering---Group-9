ALTER TYPE "CompanyInvitationState" ADD VALUE IF NOT EXISTS 'DECLINED';
ALTER TYPE "EmailKind" ADD VALUE IF NOT EXISTS 'COMPANY_INVITATION_RESPONSE';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'COMPANY_INVITATION_ACCEPTED';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'COMPANY_INVITATION_DECLINED';

ALTER TABLE "CompanyInvitation"
  ADD COLUMN IF NOT EXISTS "declinedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "declinedAt" TIMESTAMP(3);

ALTER TABLE "CompanyInvitation"
  ADD CONSTRAINT "CompanyInvitation_declinedByUserId_fkey"
  FOREIGN KEY ("declinedByUserId") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "CompanyTeamActivityKind" AS ENUM (
  'INVITED', 'ACCEPTED', 'DECLINED', 'REVOKED',
  'ROLE_CHANGED', 'SUSPENDED', 'RESTORED', 'REMOVED'
);

CREATE TABLE "CompanyTeamActivity" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "kind" "CompanyTeamActivityKind" NOT NULL,
  "actorUserId" TEXT,
  "targetEmail" TEXT NOT NULL,
  "role" "CompanyMembershipRole",
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyTeamActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyTeamActivity_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CompanyTeamActivity_companyId_occurredAt_id_idx"
  ON "CompanyTeamActivity"("companyId", "occurredAt" DESC, "id" DESC);
