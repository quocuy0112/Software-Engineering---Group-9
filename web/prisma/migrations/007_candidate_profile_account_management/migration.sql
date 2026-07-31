-- Feature 002 is a forward-only migration. Take a database backup before
-- deployment. If deployment must be abandoned before application writes begin,
-- remove the new objects in reverse dependency order in a reviewed forward-fix.
-- After Feature 002 writes begin, preserve profile/account data and roll forward;
-- do not drop these tables or enum values as an operational rollback.

-- CreateEnum
CREATE TYPE "PreferenceLanguage" AS ENUM ('VI', 'EN');
CREATE TYPE "EmailChangeStatus" AS ENUM (
  'PENDING',
  'SUPERSEDED',
  'CONSUMED',
  'EXPIRED',
  'CONFLICTED'
);
CREATE TYPE "PasswordChangeOperationStatus" AS ENUM (
  'INTENT_RECORDED',
  'PASSWORD_UPDATED',
  'OTHER_SESSIONS_REVOKED',
  'FAILED_RETRYABLE',
  'FINALIZED'
);
CREATE TYPE "PasswordChangeFailureCode" AS ENUM (
  'PASSWORD_UPDATE_FAILED',
  'SESSION_REVOCATION_FAILED',
  'SESSION_VERIFICATION_FAILED',
  'NOTIFICATION_ENQUEUE_FAILED',
  'AUDIT_FINALIZATION_FAILED',
  'OPERATION_FINALIZATION_FAILED'
);

-- ExtendEnum
ALTER TYPE "EmailKind" ADD VALUE 'EMAIL_CHANGE_VERIFY';

-- ExtendTable
ALTER TABLE "EmailOutbox"
  ADD COLUMN "recipientCiphertext" TEXT,
  ADD COLUMN "recipientPurpose" TEXT;

-- CreateTable
CREATE TABLE "CandidateProfile" (
  "id" TEXT NOT NULL,
  "candidateUserId" TEXT NOT NULL,
  "headline" TEXT,
  "summary" TEXT,
  "phone" TEXT,
  "location" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfileExperience" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "description" TEXT,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "isCurrent" BOOLEAN NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfileExperience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfileEducation" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "institution" TEXT NOT NULL,
  "degree" TEXT NOT NULL,
  "field" TEXT,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "isCurrent" BOOLEAN NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfileEducation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Skill" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateProfileSkill" (
  "profileId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateProfileSkill_pkey" PRIMARY KEY ("profileId", "skillId")
);

CREATE TABLE "SocialLink" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "normalizedUrl" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountPreferences" (
  "userId" TEXT NOT NULL,
  "language" "PreferenceLanguage" NOT NULL DEFAULT 'VI',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "applicationUpdatesEmail" BOOLEAN NOT NULL DEFAULT true,
  "jobRecommendationsEmail" BOOLEAN NOT NULL DEFAULT true,
  "accountSecurityEmail" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountPreferences_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "EmailChangeRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "proposedEmail" TEXT NOT NULL,
  "normalizedProposedEmail" TEXT NOT NULL,
  "tokenDigest" TEXT NOT NULL,
  "status" "EmailChangeStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "verificationOutboxId" TEXT,
  "oldEmailNoticeOutboxId" TEXT,
  "createdBySessionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordChangeAttemptWindow" (
  "userId" TEXT NOT NULL,
  "failureTimestamps" TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[],
  "lockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PasswordChangeAttemptWindow_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "PasswordChangeOperation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "submissionBindingDigest" TEXT NOT NULL,
  "initiatingSessionId" TEXT NOT NULL,
  "status" "PasswordChangeOperationStatus" NOT NULL DEFAULT 'INTENT_RECORDED',
  "passwordUpdatedAt" TIMESTAMP(3),
  "otherSessionsRevokedAt" TIMESTAMP(3),
  "notificationIdempotencyKey" TEXT NOT NULL,
  "notificationOutboxId" TEXT,
  "finalAuditId" TEXT,
  "failureCode" "PasswordChangeFailureCode",
  "retryAt" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PasswordChangeOperation_pkey" PRIMARY KEY ("id")
);

-- Backfill one canonical empty profile per existing candidate before enforcing
-- the one-to-one FK/index. The deterministic ID is migration-only; future IDs
-- remain generated by Prisma.
INSERT INTO "CandidateProfile" (
  "id",
  "candidateUserId",
  "updatedAt"
)
SELECT
  'profile_' || md5(identity."userId"),
  identity."userId",
  CURRENT_TIMESTAMP
FROM "CandidateIdentity" identity;

DO $$
DECLARE
  identity_count BIGINT;
  profile_count BIGINT;
  orphan_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO identity_count FROM "CandidateIdentity";
  SELECT COUNT(*) INTO profile_count FROM "CandidateProfile";
  SELECT COUNT(*) INTO orphan_count
  FROM "CandidateIdentity" identity
  LEFT JOIN "CandidateProfile" profile
    ON profile."candidateUserId" = identity."userId"
  WHERE profile."id" IS NULL;

  IF profile_count <> identity_count OR orphan_count <> 0 THEN
    RAISE EXCEPTION
      'CandidateProfile backfill count guard failed: identities=%, profiles=%, missing=%',
      identity_count,
      profile_count,
      orphan_count;
  END IF;
END
$$;

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_candidateUserId_key"
  ON "CandidateProfile"("candidateUserId");
CREATE INDEX "CandidateProfile_candidateUserId_idx"
  ON "CandidateProfile"("candidateUserId");
CREATE INDEX "ProfileExperience_profileId_idx"
  ON "ProfileExperience"("profileId");
CREATE UNIQUE INDEX "ProfileExperience_profileId_position_key"
  ON "ProfileExperience"("profileId", "position");
CREATE INDEX "ProfileEducation_profileId_idx"
  ON "ProfileEducation"("profileId");
CREATE UNIQUE INDEX "ProfileEducation_profileId_position_key"
  ON "ProfileEducation"("profileId", "position");
CREATE UNIQUE INDEX "Skill_normalizedName_key"
  ON "Skill"("normalizedName");
CREATE INDEX "CandidateProfileSkill_skillId_idx"
  ON "CandidateProfileSkill"("skillId");
CREATE UNIQUE INDEX "CandidateProfileSkill_profileId_position_key"
  ON "CandidateProfileSkill"("profileId", "position");
CREATE INDEX "SocialLink_profileId_idx"
  ON "SocialLink"("profileId");
CREATE UNIQUE INDEX "SocialLink_profileId_normalizedUrl_key"
  ON "SocialLink"("profileId", "normalizedUrl");
CREATE UNIQUE INDEX "SocialLink_profileId_position_key"
  ON "SocialLink"("profileId", "position");
CREATE UNIQUE INDEX "EmailChangeRequest_tokenDigest_key"
  ON "EmailChangeRequest"("tokenDigest");
CREATE UNIQUE INDEX "EmailChangeRequest_verificationOutboxId_key"
  ON "EmailChangeRequest"("verificationOutboxId");
CREATE UNIQUE INDEX "EmailChangeRequest_oldEmailNoticeOutboxId_key"
  ON "EmailChangeRequest"("oldEmailNoticeOutboxId");
CREATE INDEX "EmailChangeRequest_status_expiresAt_idx"
  ON "EmailChangeRequest"("status", "expiresAt");
CREATE INDEX "EmailChangeRequest_userId_createdAt_idx"
  ON "EmailChangeRequest"("userId", "createdAt" DESC);
CREATE UNIQUE INDEX "EmailChangeRequest_userId_idempotencyKey_key"
  ON "EmailChangeRequest"("userId", "idempotencyKey");
CREATE UNIQUE INDEX "EmailChangeRequest_one_pending_per_user_idx"
  ON "EmailChangeRequest"("userId")
  WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "EmailChangeRequest_one_pending_per_email_idx"
  ON "EmailChangeRequest"("normalizedProposedEmail")
  WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "PasswordChangeOperation_notificationIdempotencyKey_key"
  ON "PasswordChangeOperation"("notificationIdempotencyKey");
CREATE UNIQUE INDEX "PasswordChangeOperation_notificationOutboxId_key"
  ON "PasswordChangeOperation"("notificationOutboxId");
CREATE UNIQUE INDEX "PasswordChangeOperation_finalAuditId_key"
  ON "PasswordChangeOperation"("finalAuditId");
CREATE INDEX "PasswordChangeOperation_userId_status_idx"
  ON "PasswordChangeOperation"("userId", "status");
CREATE INDEX "PasswordChangeOperation_status_retryAt_idx"
  ON "PasswordChangeOperation"("status", "retryAt");
CREATE UNIQUE INDEX "PasswordChangeOperation_userId_idempotencyKey_key"
  ON "PasswordChangeOperation"("userId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "CandidateProfile"
  ADD CONSTRAINT "CandidateProfile_candidateUserId_fkey"
  FOREIGN KEY ("candidateUserId") REFERENCES "CandidateIdentity"("userId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileExperience"
  ADD CONSTRAINT "ProfileExperience_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileEducation"
  ADD CONSTRAINT "ProfileEducation_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateProfileSkill"
  ADD CONSTRAINT "CandidateProfileSkill_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateProfileSkill"
  ADD CONSTRAINT "CandidateProfileSkill_skillId_fkey"
  FOREIGN KEY ("skillId") REFERENCES "Skill"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SocialLink"
  ADD CONSTRAINT "SocialLink_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountPreferences"
  ADD CONSTRAINT "AccountPreferences_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailChangeRequest"
  ADD CONSTRAINT "EmailChangeRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailChangeRequest"
  ADD CONSTRAINT "EmailChangeRequest_verificationOutboxId_fkey"
  FOREIGN KEY ("verificationOutboxId") REFERENCES "EmailOutbox"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailChangeRequest"
  ADD CONSTRAINT "EmailChangeRequest_oldEmailNoticeOutboxId_fkey"
  FOREIGN KEY ("oldEmailNoticeOutboxId") REFERENCES "EmailOutbox"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PasswordChangeAttemptWindow"
  ADD CONSTRAINT "PasswordChangeAttemptWindow_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordChangeOperation"
  ADD CONSTRAINT "PasswordChangeOperation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordChangeOperation"
  ADD CONSTRAINT "PasswordChangeOperation_notificationOutboxId_fkey"
  FOREIGN KEY ("notificationOutboxId") REFERENCES "EmailOutbox"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PasswordChangeOperation"
  ADD CONSTRAINT "PasswordChangeOperation_finalAuditId_fkey"
  FOREIGN KEY ("finalAuditId") REFERENCES "AuditEvent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain constraints not expressible in Prisma.
ALTER TABLE "user"
  ADD CONSTRAINT "user_name_feature_002_length"
  CHECK (char_length(btrim("name")) BETWEEN 1 AND 150);
ALTER TABLE "CandidateProfile"
  ADD CONSTRAINT "candidate_profile_fields"
  CHECK (
    "revision" >= 0 AND
    ("headline" IS NULL OR char_length("headline") <= 200) AND
    ("summary" IS NULL OR char_length("summary") <= 5000) AND
    ("phone" IS NULL OR char_length("phone") <= 32) AND
    ("location" IS NULL OR char_length("location") <= 160)
  );
ALTER TABLE "ProfileExperience"
  ADD CONSTRAINT "profile_experience_fields"
  CHECK (
    char_length("title") BETWEEN 1 AND 200 AND
    char_length("company") BETWEEN 1 AND 200 AND
    ("description" IS NULL OR char_length("description") <= 3000) AND
    "position" BETWEEN 0 AND 49
  );
ALTER TABLE "ProfileExperience"
  ADD CONSTRAINT "profile_experience_dates"
  CHECK (
    ("isCurrent" AND "endDate" IS NULL) OR
    (NOT "isCurrent" AND "endDate" IS NOT NULL AND "endDate" >= "startDate")
  );
ALTER TABLE "ProfileEducation"
  ADD CONSTRAINT "profile_education_fields"
  CHECK (
    char_length("institution") BETWEEN 1 AND 200 AND
    char_length("degree") BETWEEN 1 AND 200 AND
    ("field" IS NULL OR char_length("field") <= 200) AND
    "position" BETWEEN 0 AND 49
  );
ALTER TABLE "ProfileEducation"
  ADD CONSTRAINT "profile_education_dates"
  CHECK (
    ("endDate" IS NULL OR "endDate" >= "startDate") AND
    ("isCurrent" OR "endDate" IS NOT NULL)
  );
ALTER TABLE "Skill"
  ADD CONSTRAINT "skill_fields"
  CHECK (
    char_length("name") BETWEEN 1 AND 80 AND
    char_length("normalizedName") BETWEEN 1 AND 80
  );
ALTER TABLE "CandidateProfileSkill"
  ADD CONSTRAINT "candidate_profile_skill_fields"
  CHECK (
    char_length("displayName") BETWEEN 1 AND 80 AND
    "position" BETWEEN 0 AND 49
  );
ALTER TABLE "SocialLink"
  ADD CONSTRAINT "social_link_fields"
  CHECK (
    char_length("url") BETWEEN 1 AND 2048 AND
    char_length("normalizedUrl") BETWEEN 1 AND 2048 AND
    "position" BETWEEN 0 AND 9
  );
ALTER TABLE "AccountPreferences"
  ADD CONSTRAINT "account_preferences_security_mail_required"
  CHECK ("accountSecurityEmail" = true);
ALTER TABLE "EmailOutbox"
  ADD CONSTRAINT "email_outbox_protected_recipient_pair"
  CHECK (
    ("recipientCiphertext" IS NULL AND "recipientPurpose" IS NULL) OR
    (
      "recipientCiphertext" IS NOT NULL AND
      "recipientPurpose" IN (
        'email-change-verification.v1',
        'email-change-old-address.v1',
        'password-change-notice.v1'
      )
    )
  );
ALTER TABLE "EmailChangeRequest"
  ADD CONSTRAINT "email_change_request_expiry"
  CHECK ("expiresAt" = "createdAt" + INTERVAL '30 minutes');
ALTER TABLE "EmailChangeRequest"
  ADD CONSTRAINT "email_change_request_state"
  CHECK (
    (
      "status" = 'PENDING' AND
      "consumedAt" IS NULL AND "supersededAt" IS NULL AND "resolvedAt" IS NULL
    ) OR (
      "status" = 'SUPERSEDED' AND
      "supersededAt" IS NOT NULL AND "consumedAt" IS NULL
    ) OR (
      "status" = 'CONSUMED' AND
      "consumedAt" IS NOT NULL AND "supersededAt" IS NULL
    ) OR (
      "status" IN ('EXPIRED', 'CONFLICTED') AND
      "resolvedAt" IS NOT NULL AND "consumedAt" IS NULL
    )
  );
ALTER TABLE "PasswordChangeAttemptWindow"
  ADD CONSTRAINT "password_change_failure_window_bounded"
  CHECK (cardinality("failureTimestamps") <= 5);
ALTER TABLE "PasswordChangeOperation"
  ADD CONSTRAINT "password_change_operation_milestones"
  CHECK (
    ("otherSessionsRevokedAt" IS NULL OR "passwordUpdatedAt" IS NOT NULL) AND
    ("finalizedAt" IS NULL OR (
      "passwordUpdatedAt" IS NOT NULL AND
      "otherSessionsRevokedAt" IS NOT NULL AND
      "notificationOutboxId" IS NOT NULL AND
      "finalAuditId" IS NOT NULL
    ))
  );
ALTER TABLE "PasswordChangeOperation"
  ADD CONSTRAINT "password_change_operation_failure"
  CHECK (
    (
      "status" = 'FAILED_RETRYABLE' AND
      "failureCode" IS NOT NULL AND "retryAt" IS NOT NULL
    ) OR (
      "status" <> 'FAILED_RETRYABLE' AND
      "failureCode" IS NULL AND "retryAt" IS NULL
    )
  );

-- The immutable recipient envelope may be read by workers, while delivery
-- state remains mutable for leasing/retry/dead-letter transitions.
CREATE OR REPLACE FUNCTION prevent_email_outbox_envelope_mutation()
RETURNS trigger AS $$
BEGIN
  IF (
    NEW."kind",
    NEW."userId",
    NEW."securityTokenId",
    NEW."recipientRef",
    NEW."recipientCiphertext",
    NEW."recipientPurpose",
    NEW."templateVersion",
    NEW."payloadRef",
    NEW."idempotencyKey"
  ) IS DISTINCT FROM (
    OLD."kind",
    OLD."userId",
    OLD."securityTokenId",
    OLD."recipientRef",
    OLD."recipientCiphertext",
    OLD."recipientPurpose",
    OLD."templateVersion",
    OLD."payloadRef",
    OLD."idempotencyKey"
  ) THEN
    RAISE EXCEPTION 'EmailOutbox delivery envelope is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "EmailOutbox_prevent_envelope_update"
BEFORE UPDATE ON "EmailOutbox"
FOR EACH ROW EXECUTE FUNCTION prevent_email_outbox_envelope_mutation();
