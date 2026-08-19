CREATE TYPE "CompanyInvitationState" AS ENUM ('PENDING', 'REVOKED', 'ACCEPTED', 'EXPIRED');

CREATE TABLE "CompanyInvitation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "role" "CompanyMembershipRole" NOT NULL,
  "state" "CompanyInvitationState" NOT NULL DEFAULT 'PENDING',
  "tokenDigest" TEXT NOT NULL,
  "invitedByUserId" TEXT NOT NULL,
  "acceptedByUserId" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyInvitation_tokenDigest_key" ON "CompanyInvitation"("tokenDigest");
CREATE UNIQUE INDEX "CompanyInvitation_one_pending_per_recipient" ON "CompanyInvitation"("companyId", "normalizedEmail") WHERE "state" = 'PENDING';
CREATE INDEX "CompanyInvitation_normalizedEmail_state_expiresAt_idx" ON "CompanyInvitation"("normalizedEmail", "state", "expiresAt");
ALTER TABLE "CompanyInvitation" ADD CONSTRAINT "CompanyInvitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvitation" ADD CONSTRAINT "CompanyInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyInvitation" ADD CONSTRAINT "CompanyInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
