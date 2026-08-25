-- AlterTable
ALTER TABLE "JobApplicationAttemptCounter" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "JobApplication_candidateUserId_jobPostingId_applicationAttemptN" RENAME TO "JobApplication_candidateUserId_jobPostingId_applicationAtte_key";
