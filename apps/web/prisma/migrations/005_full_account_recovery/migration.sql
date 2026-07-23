ALTER TYPE "TokenPurpose" ADD VALUE 'ACCOUNT_RECOVERY_CONFIRMATION';

CREATE TYPE "FullAccountRecoveryStatus" AS ENUM (
  'CONFIRMED_HOLD',
  'CANCELLED',
  'COMPLETING',
  'COMPLETED'
);

CREATE TYPE "FullAccountRecoveryFailureCode" AS ENUM (
  'HOLD_SESSION_REVOCATION_FAILED',
  'HOLD_CHALLENGE_INVALIDATION_FAILED',
  'HOLD_NOTIFICATION_ENQUEUE_FAILED',
  'PASSWORD_UPDATE_FAILED',
  'TWO_FACTOR_DISABLE_FAILED',
  'SESSION_REVOCATION_FAILED',
  'CHALLENGE_INVALIDATION_FAILED',
  'NOTIFICATION_ENQUEUE_FAILED',
  'AUDIT_FINALIZATION_FAILED',
  'OPERATION_FINALIZATION_FAILED'
);

CREATE TABLE "FullAccountRecoveryOperation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "confirmationTokenId" TEXT NOT NULL,
  "operationKey" TEXT NOT NULL,
  "status" "FullAccountRecoveryStatus" NOT NULL DEFAULT 'CONFIRMED_HOLD',
  "confirmationProofDigest" TEXT NOT NULL,
  "confirmationExpiresAt" TIMESTAMP(3) NOT NULL,
  "confirmationConsumedAt" TIMESTAMP(3) NOT NULL,
  "confirmationFinalizedAt" TIMESTAMP(3),
  "completionProofDigest" TEXT NOT NULL,
  "completionProofCiphertext" TEXT NOT NULL,
  "completionProofExpiresAt" TIMESTAMP(3) NOT NULL,
  "completionConsumedAt" TIMESTAMP(3),
  "completionKey" TEXT,
  "cancellationProofDigest" TEXT NOT NULL,
  "cancellationProofCiphertext" TEXT NOT NULL,
  "cancellationProofExpiresAt" TIMESTAMP(3) NOT NULL,
  "cancellationConsumedAt" TIMESTAMP(3),
  "holdStartedAt" TIMESTAMP(3) NOT NULL,
  "holdEndsAt" TIMESTAMP(3) NOT NULL,
  "holdSessionsRevokedAt" TIMESTAMP(3),
  "holdChallengesInvalidatedAt" TIMESTAMP(3),
  "confirmationAuditIntentKey" TEXT NOT NULL,
  "confirmationFinalAuditId" TEXT,
  "pendingNotificationIdempotencyKey" TEXT NOT NULL,
  "pendingNotificationOutboxId" TEXT,
  "pendingNotificationEnqueuedAt" TIMESTAMP(3),
  "cancellationNotificationIdempotencyKey" TEXT NOT NULL,
  "cancellationNotificationOutboxId" TEXT,
  "cancellationAuditId" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "completionAuditIntentKey" TEXT NOT NULL,
  "completionNotificationIdempotencyKey" TEXT NOT NULL,
  "completionNotificationOutboxId" TEXT,
  "completionFinalAuditId" TEXT,
  "passwordUpdatedAt" TIMESTAMP(3),
  "twoFactorDisabledAt" TIMESTAMP(3),
  "completionSessionsRevokedAt" TIMESTAMP(3),
  "completionChallengesInvalidatedAt" TIMESTAMP(3),
  "completionNotificationEnqueuedAt" TIMESTAMP(3),
  "completionAuditFinalizedAt" TIMESTAMP(3),
  "failureCode" "FullAccountRecoveryFailureCode",
  "retryAt" TIMESTAMP(3),
  "executionOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FullAccountRecoveryOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FullAccountRecoveryOperation_confirmationTokenId_key"
  ON "FullAccountRecoveryOperation"("confirmationTokenId");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_operationKey_key"
  ON "FullAccountRecoveryOperation"("operationKey");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_confirmationProofDigest_key"
  ON "FullAccountRecoveryOperation"("confirmationProofDigest");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_completionProofDigest_key"
  ON "FullAccountRecoveryOperation"("completionProofDigest");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_completionKey_key"
  ON "FullAccountRecoveryOperation"("completionKey");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_cancellationProofDigest_key"
  ON "FullAccountRecoveryOperation"("cancellationProofDigest");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_confirmationAuditIntentKey_key"
  ON "FullAccountRecoveryOperation"("confirmationAuditIntentKey");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_confirmationFinalAuditId_key"
  ON "FullAccountRecoveryOperation"("confirmationFinalAuditId");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_pendingNotificationIdempotencyKey_key"
  ON "FullAccountRecoveryOperation"("pendingNotificationIdempotencyKey");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_pendingNotificationOutboxId_key"
  ON "FullAccountRecoveryOperation"("pendingNotificationOutboxId");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_cancellationNotificationIdempotencyKey_key"
  ON "FullAccountRecoveryOperation"("cancellationNotificationIdempotencyKey");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_cancellationNotificationOutboxId_key"
  ON "FullAccountRecoveryOperation"("cancellationNotificationOutboxId");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_cancellationAuditId_key"
  ON "FullAccountRecoveryOperation"("cancellationAuditId");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_completionAuditIntentKey_key"
  ON "FullAccountRecoveryOperation"("completionAuditIntentKey");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_completionNotificationIdempotencyKey_key"
  ON "FullAccountRecoveryOperation"("completionNotificationIdempotencyKey");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_completionNotificationOutboxId_key"
  ON "FullAccountRecoveryOperation"("completionNotificationOutboxId");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_completionFinalAuditId_key"
  ON "FullAccountRecoveryOperation"("completionFinalAuditId");
CREATE INDEX "FullAccountRecoveryOperation_userId_status_idx"
  ON "FullAccountRecoveryOperation"("userId", "status");
CREATE INDEX "FullAccountRecoveryOperation_status_holdEndsAt_idx"
  ON "FullAccountRecoveryOperation"("status", "holdEndsAt");
CREATE INDEX "FullAccountRecoveryOperation_status_retryAt_idx"
  ON "FullAccountRecoveryOperation"("status", "retryAt");
CREATE INDEX "FullAccountRecoveryOperation_leaseExpiresAt_idx"
  ON "FullAccountRecoveryOperation"("leaseExpiresAt");
CREATE UNIQUE INDEX "FullAccountRecoveryOperation_one_active_per_user_idx"
  ON "FullAccountRecoveryOperation"("userId")
  WHERE "status" IN ('CONFIRMED_HOLD', 'COMPLETING');
CREATE INDEX "FullAccountRecoveryOperation_login_block_idx"
  ON "FullAccountRecoveryOperation"("userId")
  WHERE "status" IN ('CONFIRMED_HOLD', 'COMPLETING');

ALTER TABLE "FullAccountRecoveryOperation"
  ADD CONSTRAINT "FullAccountRecoveryOperation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FullAccountRecoveryOperation"
  ADD CONSTRAINT "FullAccountRecoveryOperation_confirmationTokenId_fkey"
  FOREIGN KEY ("confirmationTokenId") REFERENCES "SecurityToken"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FullAccountRecoveryOperation"
  ADD CONSTRAINT "full_account_recovery_exact_hold" CHECK (
    "holdEndsAt" = "holdStartedAt" + INTERVAL '24 hours'
  );
ALTER TABLE "FullAccountRecoveryOperation"
  ADD CONSTRAINT "full_account_recovery_proof_expiry" CHECK (
    "confirmationExpiresAt" > "confirmationConsumedAt" AND
    "cancellationProofExpiresAt" = "holdEndsAt" AND
    "completionProofExpiresAt" = "holdEndsAt" + INTERVAL '7 days'
  );
ALTER TABLE "FullAccountRecoveryOperation"
  ADD CONSTRAINT "full_account_recovery_hold_milestones" CHECK (
    ("holdChallengesInvalidatedAt" IS NULL OR "holdSessionsRevokedAt" IS NOT NULL) AND
    ("pendingNotificationEnqueuedAt" IS NULL OR "holdChallengesInvalidatedAt" IS NOT NULL) AND
    ("confirmationFinalizedAt" IS NULL OR (
      "pendingNotificationEnqueuedAt" IS NOT NULL AND
      "confirmationFinalAuditId" IS NOT NULL
    ))
  );
ALTER TABLE "FullAccountRecoveryOperation"
  ADD CONSTRAINT "full_account_recovery_completion_milestones" CHECK (
    ("twoFactorDisabledAt" IS NULL OR "passwordUpdatedAt" IS NOT NULL) AND
    ("completionSessionsRevokedAt" IS NULL OR "twoFactorDisabledAt" IS NOT NULL) AND
    ("completionChallengesInvalidatedAt" IS NULL OR "completionSessionsRevokedAt" IS NOT NULL) AND
    ("completionNotificationEnqueuedAt" IS NULL OR "completionChallengesInvalidatedAt" IS NOT NULL) AND
    ("completionAuditFinalizedAt" IS NULL OR "completionNotificationEnqueuedAt" IS NOT NULL) AND
    ("completedAt" IS NULL OR "completionAuditFinalizedAt" IS NOT NULL)
  );
ALTER TABLE "FullAccountRecoveryOperation"
  ADD CONSTRAINT "full_account_recovery_state" CHECK (
    (
      "status" = 'CONFIRMED_HOLD' AND
      "cancelledAt" IS NULL AND "completedAt" IS NULL AND
      "completionConsumedAt" IS NULL AND "completionKey" IS NULL
    ) OR (
      "status" = 'CANCELLED' AND
      "cancelledAt" IS NOT NULL AND "cancellationConsumedAt" IS NOT NULL AND
      "completedAt" IS NULL AND "completionConsumedAt" IS NULL
    ) OR (
      "status" = 'COMPLETING' AND
      "completionConsumedAt" IS NOT NULL AND "completionKey" IS NOT NULL AND
      "cancelledAt" IS NULL AND "completedAt" IS NULL
    ) OR (
      "status" = 'COMPLETED' AND
      "completionConsumedAt" IS NOT NULL AND "completionKey" IS NOT NULL AND
      "completedAt" IS NOT NULL AND "cancelledAt" IS NULL
    )
  );
ALTER TABLE "FullAccountRecoveryOperation"
  ADD CONSTRAINT "full_account_recovery_failure" CHECK (
    ("failureCode" IS NULL AND "retryAt" IS NULL) OR
    (
      "failureCode" IS NOT NULL AND "retryAt" IS NOT NULL AND
      "status" IN ('CONFIRMED_HOLD', 'COMPLETING')
    )
  );
