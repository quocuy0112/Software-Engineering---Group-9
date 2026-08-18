DO $$ BEGIN
  CREATE TYPE "InAppNotificationAudience" AS ENUM ('USER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'SUPPORT_CASE_RECEIVED';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'SUPPORT_REQUESTER_REPLIED';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'SUPPORT_CASE_REOPENED';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'MESSAGE_REPORT_RECEIVED_ADMIN';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'MODERATION_REPORT_RECEIVED_ADMIN';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'VERIFICATION_REVIEW_OVERDUE';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'DELIVERY_MANUAL_INTERVENTION_REQUIRED';

ALTER TABLE "InAppNotification"
  ADD COLUMN IF NOT EXISTS "audience" "InAppNotificationAudience" NOT NULL DEFAULT 'USER';

UPDATE "InAppNotification"
SET "audience" = 'ADMIN'
WHERE "variables" ->> 'audience' = 'ADMIN';

CREATE INDEX IF NOT EXISTS "InAppNotification_recipientUserId_audience_readAt_expiresAt_idx"
  ON "InAppNotification"("recipientUserId", "audience", "readAt", "expiresAt");
