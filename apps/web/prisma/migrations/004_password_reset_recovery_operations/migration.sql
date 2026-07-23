-- This increment implements only the normal password-reset operation.
-- FullAccountRecoveryOperation remains deferred by the approved artifacts.

CREATE TYPE "PasswordResetOperationStatus" AS ENUM (
  'CLAIMED',
  'PASSWORD_UPDATED',
  'SESSIONS_REVOKED',
  'CHALLENGES_INVALIDATED',
  'NOTIFICATION_ENQUEUED',
  'FAILED_RETRYABLE',
  'FINALIZED'
);

CREATE TYPE "PasswordResetFailureCode" AS ENUM (
  'PASSWORD_UPDATE_FAILED',
  'SESSION_REVOCATION_FAILED',
  'CHALLENGE_INVALIDATION_FAILED',
  'NOTIFICATION_ENQUEUE_FAILED',
  'AUDIT_FINALIZATION_FAILED',
  'OPERATION_FINALIZATION_FAILED'
);

CREATE TABLE "PasswordResetOperation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "securityTokenId" TEXT NOT NULL,
  "operationKey" TEXT NOT NULL,
  "status" "PasswordResetOperationStatus" NOT NULL DEFAULT 'CLAIMED',
  "auditIntentKey" TEXT NOT NULL,
  "notificationIdempotencyKey" TEXT NOT NULL,
  "notificationOutboxId" TEXT,
  "finalAuditId" TEXT,
  "passwordUpdatedAt" TIMESTAMP(3),
  "sessionsRevokedAt" TIMESTAMP(3),
  "challengesInvalidatedAt" TIMESTAMP(3),
  "notificationEnqueuedAt" TIMESTAMP(3),
  "auditFinalizedAt" TIMESTAMP(3),
  "failureCode" "PasswordResetFailureCode",
  "retryAt" TIMESTAMP(3),
  "executionOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PasswordResetOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetOperation_securityTokenId_key"
  ON "PasswordResetOperation"("securityTokenId");
CREATE UNIQUE INDEX "PasswordResetOperation_operationKey_key"
  ON "PasswordResetOperation"("operationKey");
CREATE UNIQUE INDEX "PasswordResetOperation_auditIntentKey_key"
  ON "PasswordResetOperation"("auditIntentKey");
CREATE UNIQUE INDEX "PasswordResetOperation_notificationIdempotencyKey_key"
  ON "PasswordResetOperation"("notificationIdempotencyKey");
CREATE UNIQUE INDEX "PasswordResetOperation_notificationOutboxId_key"
  ON "PasswordResetOperation"("notificationOutboxId");
CREATE UNIQUE INDEX "PasswordResetOperation_finalAuditId_key"
  ON "PasswordResetOperation"("finalAuditId");
CREATE INDEX "PasswordResetOperation_userId_finalizedAt_idx"
  ON "PasswordResetOperation"("userId", "finalizedAt");
CREATE INDEX "PasswordResetOperation_status_retryAt_idx"
  ON "PasswordResetOperation"("status", "retryAt");
CREATE INDEX "PasswordResetOperation_leaseExpiresAt_idx"
  ON "PasswordResetOperation"("leaseExpiresAt");
CREATE INDEX "PasswordResetOperation_unresolved_user_idx"
  ON "PasswordResetOperation"("userId") WHERE "finalizedAt" IS NULL;

ALTER TABLE "PasswordResetOperation"
  ADD CONSTRAINT "PasswordResetOperation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetOperation"
  ADD CONSTRAINT "PasswordResetOperation_securityTokenId_fkey"
  FOREIGN KEY ("securityTokenId") REFERENCES "SecurityToken"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PasswordResetOperation"
  ADD CONSTRAINT "password_reset_operation_milestone_order" CHECK (
    ("sessionsRevokedAt" IS NULL OR "passwordUpdatedAt" IS NOT NULL) AND
    ("challengesInvalidatedAt" IS NULL OR "sessionsRevokedAt" IS NOT NULL) AND
    ("notificationEnqueuedAt" IS NULL OR "challengesInvalidatedAt" IS NOT NULL) AND
    ("auditFinalizedAt" IS NULL OR "notificationEnqueuedAt" IS NOT NULL) AND
    ("finalizedAt" IS NULL OR "auditFinalizedAt" IS NOT NULL)
  );

ALTER TABLE "PasswordResetOperation"
  ADD CONSTRAINT "password_reset_operation_final_state" CHECK (
    ("status" = 'FINALIZED' AND "finalizedAt" IS NOT NULL AND "failureCode" IS NULL) OR
    ("status" <> 'FINALIZED' AND "finalizedAt" IS NULL)
  );

ALTER TABLE "PasswordResetOperation"
  ADD CONSTRAINT "password_reset_operation_failure_state" CHECK (
    ("status" = 'FAILED_RETRYABLE' AND "failureCode" IS NOT NULL AND "retryAt" IS NOT NULL) OR
    ("status" <> 'FAILED_RETRYABLE' AND "failureCode" IS NULL AND "retryAt" IS NULL)
  );
