-- CreateEnum
CREATE TYPE "AccountState" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'SUPERSEDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ChallengePurpose" AS ENUM ('PASSWORD_LOGIN_2FA', 'RECENT_AUTH');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- CreateEnum
CREATE TYPE "EmailKind" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD', 'PASSWORD_CHANGED', 'SECURITY_ALERT');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'RETRYABLE', 'DEAD');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "state" "AccountState" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stateChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateIdentity" (
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateIdentity_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SecurityToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "tokenDigest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByRequestId" TEXT NOT NULL,

    CONSTRAINT "SecurityToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthenticationChallenge" (
    "id" TEXT NOT NULL,
    "handleDigest" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "ChallengePurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" TIMESTAMP(3),
    "contextDigest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthenticationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "scope" TEXT NOT NULL,
    "subjectDigest" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("scope","subjectDigest","windowStart")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "kind" "EmailKind" NOT NULL,
    "userId" TEXT,
    "securityTokenId" TEXT,
    "recipientRef" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "payloadRef" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerMessageId" TEXT,
    "safeErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorSessionId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "result" "AuditResult" NOT NULL,
    "correlationId" TEXT NOT NULL,
    "ipPrefixDigest" TEXT,
    "userAgentFamily" TEXT,
    "context" JSONB NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_normalizedEmail_key" ON "user"("normalizedEmail");

-- CreateIndex
CREATE INDEX "user_state_id_idx" ON "user"("state", "id");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_expiresAt_idx" ON "session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "session_userId_lastActivityAt_idx" ON "session"("userId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "session_absoluteExpiresAt_idx" ON "session"("absoluteExpiresAt");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "twoFactor_userId_key" ON "twoFactor"("userId");

-- CreateIndex
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor"("secret");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityToken_tokenDigest_key" ON "SecurityToken"("tokenDigest");

-- CreateIndex
CREATE INDEX "SecurityToken_expiresAt_status_idx" ON "SecurityToken"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "SecurityToken_userId_purpose_status_idx" ON "SecurityToken"("userId", "purpose", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AuthenticationChallenge_handleDigest_key" ON "AuthenticationChallenge"("handleDigest");

-- CreateIndex
CREATE INDEX "AuthenticationChallenge_handleDigest_expiresAt_idx" ON "AuthenticationChallenge"("handleDigest", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthenticationChallenge_userId_expiresAt_idx" ON "AuthenticationChallenge"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_blockedUntil_idx" ON "RateLimitBucket"("blockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "EmailOutbox_idempotencyKey_key" ON "EmailOutbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_nextAttemptAt_idx" ON "EmailOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_leaseExpiresAt_idx" ON "EmailOutbox"("leaseExpiresAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_occurredAt_idx" ON "AuditEvent"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_targetType_targetId_occurredAt_idx" ON "AuditEvent"("targetType", "targetId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_occurredAt_idx" ON "AuditEvent"("action", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification" ADD CONSTRAINT "verification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateIdentity" ADD CONSTRAINT "CandidateIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityToken" ADD CONSTRAINT "SecurityToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthenticationChallenge" ADD CONSTRAINT "AuthenticationChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_securityTokenId_fkey" FOREIGN KEY ("securityTokenId") REFERENCES "SecurityToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SmartHire domain integrity constraints not expressible in Prisma schema.
ALTER TABLE "user" ADD CONSTRAINT "user_deleted_state_consistency" CHECK (
  ("state" = 'DELETED' AND "deletedAt" IS NOT NULL) OR
  ("state" <> 'DELETED' AND "deletedAt" IS NULL)
);

ALTER TABLE "session" ADD CONSTRAINT "session_expiry_consistency" CHECK (
  "expiresAt" > "createdAt" AND "absoluteExpiresAt" >= "expiresAt"
);

ALTER TABLE "SecurityToken" ADD CONSTRAINT "security_token_expiry_consistency" CHECK ("expiresAt" > "createdAt");
ALTER TABLE "SecurityToken" ADD CONSTRAINT "security_token_status_timestamps" CHECK (
  ("status" = 'CONSUMED' AND "consumedAt" IS NOT NULL AND "supersededAt" IS NULL) OR
  ("status" = 'SUPERSEDED' AND "supersededAt" IS NOT NULL AND "consumedAt" IS NULL) OR
  ("status" IN ('ACTIVE', 'EXPIRED') AND "consumedAt" IS NULL AND "supersededAt" IS NULL)
);

ALTER TABLE "AuthenticationChallenge" ADD CONSTRAINT "authentication_challenge_bounds" CHECK (
  "expiresAt" > "createdAt" AND "maxAttempts" > 0 AND "attemptCount" >= 0 AND "attemptCount" <= "maxAttempts"
);

ALTER TABLE "RateLimitBucket" ADD CONSTRAINT "rate_limit_count_nonnegative" CHECK ("count" >= 0);
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "email_outbox_attempts_nonnegative" CHECK ("attempts" >= 0);

CREATE UNIQUE INDEX "SecurityToken_one_active_per_purpose"
  ON "SecurityToken" ("userId", "purpose") WHERE "status" = 'ACTIVE';

CREATE OR REPLACE FUNCTION prevent_audit_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditEvent is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditEvent_prevent_update_delete"
BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
