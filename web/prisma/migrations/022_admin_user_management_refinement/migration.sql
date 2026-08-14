-- Feature 009: additive admin rejection reason, dual-channel verification
-- outcome persistence, and bounded account-directory indexes.
-- Existing rows are intentionally not rewritten.

ALTER TABLE "RecruiterVerificationRequest"
  ADD COLUMN "adminComment" TEXT;

CREATE TYPE "VerificationNotificationEventKind" AS ENUM (
  'VERIFICATION_APPROVED',
  'VERIFICATION_REJECTED',
  'VERIFICATION_DELAYED',
  'VERIFICATION_EXPIRED'
);

CREATE TYPE "VerificationNotificationChannelStatus" AS ENUM (
  'QUEUED',
  'DELIVERED',
  'FAILED'
);

CREATE TABLE "VerificationNotificationEvent" (
  "id" TEXT NOT NULL,
  "verificationRequestId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "eventKind" "VerificationNotificationEventKind" NOT NULL,
  "resultingStatus" "RecruiterVerificationState" NOT NULL,
  "eventTime" TIMESTAMP(3) NOT NULL,
  "payloadRef" JSONB NOT NULL,
  "emailStatus" "VerificationNotificationChannelStatus" NOT NULL DEFAULT 'QUEUED',
  "inAppStatus" "VerificationNotificationChannelStatus" NOT NULL DEFAULT 'QUEUED',
  "emailOutboxId" TEXT,
  "inAppNotificationRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VerificationNotificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerificationNotificationEvent_idempotencyKey_key"
  ON "VerificationNotificationEvent"("idempotencyKey");
CREATE UNIQUE INDEX "VerificationNotificationEvent_emailOutboxId_key"
  ON "VerificationNotificationEvent"("emailOutboxId");
CREATE UNIQUE INDEX "VerificationNotificationEvent_inAppNotificationRef_key"
  ON "VerificationNotificationEvent"("inAppNotificationRef");
CREATE INDEX "VerificationNotificationEvent_verificationRequestId_eventKind_idx"
  ON "VerificationNotificationEvent"("verificationRequestId", "eventKind");
CREATE INDEX "VerificationNotificationEvent_emailStatus_inAppStatus_updatedAt_idx"
  ON "VerificationNotificationEvent"("emailStatus", "inAppStatus", "updatedAt");

CREATE INDEX "user_state_createdAt_id_idx"
  ON "user"("state", "createdAt" DESC, "id");
CREATE INDEX "user_normalizedEmail_trgm_idx"
  ON "user" USING GIN ("normalizedEmail" gin_trgm_ops);

ALTER TABLE "VerificationNotificationEvent"
  ADD CONSTRAINT "VerificationNotificationEvent_verificationRequestId_fkey"
  FOREIGN KEY ("verificationRequestId")
  REFERENCES "RecruiterVerificationRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VerificationNotificationEvent"
  ADD CONSTRAINT "VerificationNotificationEvent_emailOutboxId_fkey"
  FOREIGN KEY ("emailOutboxId")
  REFERENCES "EmailOutbox"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
