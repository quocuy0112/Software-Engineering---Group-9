-- CreateIndex
CREATE INDEX "JobPostReviewAggregate_pendingVersionId_version_idx" ON "JobPostReviewAggregate"("pendingVersionId", "version");

-- RenameIndex
ALTER INDEX "JobPostReviewHistory_reviewVersionId_resultingAggregateVersion_" RENAME TO "JobPostReviewHistory_reviewVersionId_resultingAggregateVers_key";
