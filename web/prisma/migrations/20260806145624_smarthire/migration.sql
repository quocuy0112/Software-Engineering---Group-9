-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "aiAnalysisConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiMatchScore" INTEGER,
ADD COLUMN     "contactSnapshot" JSONB,
ADD COLUMN     "cvFileRef" TEXT;

-- CreateIndex
CREATE INDEX "JobApplication_candidateUserId_aiAnalysisConsent_idx" ON "JobApplication"("candidateUserId", "aiAnalysisConsent");

-- RenameIndex
ALTER INDEX "FullAccountRecoveryOperation_cancellationNotificationIdempotenc" RENAME TO "FullAccountRecoveryOperation_cancellationNotificationIdempo_key";

-- RenameIndex
ALTER INDEX "FullAccountRecoveryOperation_cancellationNotificationOutboxId_k" RENAME TO "FullAccountRecoveryOperation_cancellationNotificationOutbox_key";

-- RenameIndex
ALTER INDEX "FullAccountRecoveryOperation_completionNotificationIdempotencyK" RENAME TO "FullAccountRecoveryOperation_completionNotificationIdempote_key";

-- RenameIndex
ALTER INDEX "FullAccountRecoveryOperation_pendingNotificationIdempotencyKey_" RENAME TO "FullAccountRecoveryOperation_pendingNotificationIdempotency_key";
