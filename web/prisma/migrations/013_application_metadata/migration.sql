-- Add the application metadata already exposed by the Prisma and HTTP
-- contracts. This is forward-only so previously applied migrations remain
-- immutable.

ALTER TABLE "JobApplication"
  ADD COLUMN "cvFileRef" TEXT,
  ADD COLUMN "contactSnapshot" JSONB,
  ADD COLUMN "aiAnalysisConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "aiMatchScore" INTEGER;

CREATE INDEX "JobApplication_candidateUserId_aiAnalysisConsent_idx"
  ON "JobApplication"("candidateUserId", "aiAnalysisConsent");

-- PostgreSQL truncated these names differently from Prisma's current stable
-- identifiers. Rename them so migration history and the Prisma schema have no
-- residual drift.
ALTER INDEX "FullAccountRecoveryOperation_cancellationNotificationIdempotenc"
  RENAME TO "FullAccountRecoveryOperation_cancellationNotificationIdempo_key";
ALTER INDEX "FullAccountRecoveryOperation_cancellationNotificationOutboxId_k"
  RENAME TO "FullAccountRecoveryOperation_cancellationNotificationOutbox_key";
ALTER INDEX "FullAccountRecoveryOperation_completionNotificationIdempotencyK"
  RENAME TO "FullAccountRecoveryOperation_completionNotificationIdempote_key";
ALTER INDEX "FullAccountRecoveryOperation_pendingNotificationIdempotencyKey_"
  RENAME TO "FullAccountRecoveryOperation_pendingNotificationIdempotency_key";
