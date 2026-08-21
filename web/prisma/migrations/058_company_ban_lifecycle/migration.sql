CREATE TYPE "CompanyModerationState" AS ENUM ('ACTIVE', 'BANNED');

ALTER TABLE "Company"
  ADD COLUMN "moderationState" "CompanyModerationState" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "moderationVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "bannedAt" TIMESTAMP(3),
  ADD COLUMN "verificationStateBeforeBan" "CompanyVerificationState",
  ADD COLUMN "verifiedAtBeforeBan" TIMESTAMP(3);
