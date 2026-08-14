DO $$ BEGIN
  CREATE TYPE "InAppNotificationSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "InAppNotificationCategory" AS ENUM ('SECURITY', 'ACCOUNT', 'APPLICATION', 'VERIFICATION', 'SUPPORT', 'CONNECTION', 'MESSAGING', 'MODERATION', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "InAppNotificationContextType" AS ENUM ('ACCOUNT', 'MEMBERSHIP', 'APPLICATION', 'VERIFICATION_REQUEST', 'SUPPORT_CASE', 'CONNECTION_PROPOSAL', 'CONNECTION', 'CONVERSATION', 'MESSAGING_REPORT', 'MODERATION_REPORT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
CREATE TYPE "InAppNotificationKind" AS ENUM (
  'EMAIL_CHANGE_REQUESTED_ALERT', 'PASSWORD_CHANGED', 'RECOVERY_PENDING',
  'RECOVERY_CANCELLED', 'RECOVERY_COMPLETED', 'ACCOUNT_SUSPENDED',
  'ACCOUNT_REINSTATED', 'ALL_SESSIONS_REVOKED', 'MEMBERSHIP_SUSPENDED',
  'MEMBERSHIP_RESTORED', 'MEMBERSHIP_REMOVED', 'APPLICATION_SUBMITTED',
  'APPLICATION_RECEIVED', 'APPLICATION_STAGE_CHANGED', 'VERIFICATION_RECEIVED',
  'VERIFICATION_CHANGES_REQUESTED', 'VERIFICATION_APPROVED',
  'VERIFICATION_REJECTED', 'VERIFICATION_CANCELLED', 'VERIFICATION_DELAYED',
  'VERIFICATION_EXPIRED', 'SUPPORT_WAITING_FOR_USER', 'SUPPORT_RESOLVED',
  'CONNECTION_PROPOSAL_CREATED', 'CONNECTION_PROPOSAL_UPDATED',
  'CONNECTION_PROPOSAL_INACTIVE', 'CONNECTION_ACCEPTED', 'CONNECTION_REVOKED',
  'MESSAGE_RECEIVED', 'MESSAGE_REPORT_RECEIVED', 'MESSAGE_REPORT_RESOLVED',
  'MESSAGE_REPORT_DISMISSED', 'MODERATION_REPORT_RECEIVED',
  'MODERATION_REPORT_RESOLVED', 'MODERATION_REPORT_DISMISSED'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "InAppNotification" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "kind" "InAppNotificationKind" NOT NULL,
  "category" "InAppNotificationCategory" NOT NULL,
  "severity" "InAppNotificationSeverity" NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "summary" VARCHAR(500) NOT NULL,
  "href" VARCHAR(500),
  "contextType" "InAppNotificationContextType",
  "contextId" VARCHAR(128),
  "deduplicationKey" VARCHAR(255) NOT NULL,
  "correlationId" VARCHAR(128) NOT NULL,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "readAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastOccurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InAppNotification_context_pair_check" CHECK (("contextType" IS NULL) = ("contextId" IS NULL)),
  CONSTRAINT "InAppNotification_occurrence_count_check" CHECK ("occurrenceCount" >= 1),
  CONSTRAINT "InAppNotification_internal_href_check" CHECK ("href" IS NULL OR ("href" LIKE '/%' AND "href" NOT LIKE '//%'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "InAppNotification_deduplicationKey_key" ON "InAppNotification"("deduplicationKey");
CREATE INDEX IF NOT EXISTS "InAppNotification_recipientUserId_lastOccurredAt_id_idx" ON "InAppNotification"("recipientUserId", "lastOccurredAt" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "InAppNotification_recipientUserId_readAt_expiresAt_idx" ON "InAppNotification"("recipientUserId", "readAt", "expiresAt");
CREATE INDEX IF NOT EXISTS "InAppNotification_recipientUserId_contextType_contextId_readAt_idx" ON "InAppNotification"("recipientUserId", "contextType", "contextId", "readAt");
CREATE INDEX IF NOT EXISTS "InAppNotification_expiresAt_id_idx" ON "InAppNotification"("expiresAt", "id");

DELETE FROM "InAppNotification" notification
WHERE NOT EXISTS (
  SELECT 1 FROM "user" account WHERE account."id" = notification."recipientUserId"
);

DO $$ BEGIN
  ALTER TABLE "InAppNotification"
    ADD CONSTRAINT "InAppNotification_recipientUserId_fkey"
    FOREIGN KEY ("recipientUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "InAppNotification" (
  "id", "recipientUserId", "kind", "category", "severity", "title", "summary",
  "href", "contextType", "contextId", "deduplicationKey", "correlationId",
  "occurrenceCount", "readAt", "expiresAt", "createdAt", "lastOccurredAt", "updatedAt"
)
SELECT
  'legacy-connection-' || n."id",
  n."recipientUserId",
  CASE n."kind"::text
    WHEN 'PROPOSAL_CREATED' THEN 'CONNECTION_PROPOSAL_CREATED'::"InAppNotificationKind"
    WHEN 'PROPOSAL_UPDATED' THEN 'CONNECTION_PROPOSAL_UPDATED'::"InAppNotificationKind"
    WHEN 'PROPOSAL_NO_LONGER_ACTIVE' THEN 'CONNECTION_PROPOSAL_INACTIVE'::"InAppNotificationKind"
    WHEN 'CONNECTION_ACCEPTED' THEN 'CONNECTION_ACCEPTED'::"InAppNotificationKind"
    ELSE 'CONNECTION_REVOKED'::"InAppNotificationKind"
  END,
  'CONNECTION'::"InAppNotificationCategory",
  'MEDIUM'::"InAppNotificationSeverity",
  'Professional connection update',
  'Your professional connection status changed.',
  '/connections',
  CASE WHEN n."proposalId" IS NOT NULL THEN 'CONNECTION_PROPOSAL'::"InAppNotificationContextType" ELSE 'CONNECTION'::"InAppNotificationContextType" END,
  COALESCE(n."proposalId", n."connectionId"),
  n."deduplicationKey",
  LEFT(n."deduplicationKey", 128),
  1,
  n."readAt",
  LEAST(n."deleteAfter", n."createdAt" + INTERVAL '90 days'),
  n."createdAt",
  n."createdAt",
  n."createdAt"
FROM "ProfessionalConnectionNotification" n
WHERE n."deleteAfter" > CURRENT_TIMESTAMP
ON CONFLICT ("deduplicationKey") DO NOTHING;
