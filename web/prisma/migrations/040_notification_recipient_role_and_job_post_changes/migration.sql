-- Persist the event audience so deep-link resolution is deterministic even when
-- a user later has multiple roles. Existing ADMIN rows remain ADMIN; the
-- legacy USER rows are conservatively backfilled by their known event kind.
CREATE TYPE "InAppNotificationRecipientRole" AS ENUM ('CANDIDATE', 'RECRUITER', 'ADMIN');

ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'JOB_POST_CHANGES_REQUESTED';

ALTER TABLE "InAppNotification"
  ADD COLUMN "recipientRole" "InAppNotificationRecipientRole" NOT NULL DEFAULT 'CANDIDATE';

UPDATE "InAppNotification"
SET "recipientRole" = CASE
  WHEN "audience" = 'ADMIN' THEN 'ADMIN'::"InAppNotificationRecipientRole"
  WHEN "kind" IN ('APPLICATION_RECEIVED', 'JOB_POST_APPROVED', 'JOB_POST_REJECTED')
    THEN 'RECRUITER'::"InAppNotificationRecipientRole"
  ELSE 'CANDIDATE'::"InAppNotificationRecipientRole"
END;

CREATE INDEX "InAppNotification_recipientUserId_recipientRole_readAt_expiresAt_idx"
  ON "InAppNotification"("recipientUserId", "recipientRole", "readAt", "expiresAt");
