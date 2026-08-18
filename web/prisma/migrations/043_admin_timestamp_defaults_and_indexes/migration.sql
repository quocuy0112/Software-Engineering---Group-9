-- AlterTable
ALTER TABLE "ApplicationIntake" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ApplicationNotificationPreference" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CandidateApplicationDraft" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "JobPostReviewAggregate_pendingVersionId_version_idx" ON "JobPostReviewAggregate"("pendingVersionId", "version");

-- RenameIndex
ALTER INDEX "InAppNotification_recipientUserId_recipientRole_readAt_expiresA" RENAME TO "InAppNotification_recipientUserId_recipientRole_readAt_expi_idx";

-- RenameIndex
ALTER INDEX "JobPostReviewHistory_reviewVersionId_resultingAggregateVersion_" RENAME TO "JobPostReviewHistory_reviewVersionId_resultingAggregateVers_key";
