-- Feature 007 minimal accepted-connection dependency and Feature 008 messaging.
-- This migration is additive. Recovery is to stop the application, archive the
-- new tables if required, then drop only the objects created below.

CREATE TYPE "ProfessionalConnectionStatus" AS ENUM ('ACCEPTED');
CREATE TYPE "MessagingConversationContextType" AS ENUM ('APPLICATION', 'PROFESSIONAL_CONNECTION');
CREATE TYPE "MessagingReportTargetType" AS ENUM ('PARTICIPANT', 'CONVERSATION');

CREATE TABLE "ProfessionalConnection" (
  "id" TEXT NOT NULL,
  "participantLowId" TEXT NOT NULL,
  "participantHighId" TEXT NOT NULL,
  "state" "ProfessionalConnectionStatus" NOT NULL DEFAULT 'ACCEPTED',
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalConnection_pair_check" CHECK ("participantLowId" < "participantHighId")
);

CREATE TABLE "MessagingConversation" (
  "id" TEXT NOT NULL,
  "participantLowId" TEXT NOT NULL,
  "participantHighId" TEXT NOT NULL,
  "contextType" "MessagingConversationContextType" NOT NULL,
  "contextReference" TEXT NOT NULL,
  "applicationId" TEXT,
  "companyId" TEXT,
  "professionalConnectionId" TEXT,
  "nextMessageSequence" INTEGER NOT NULL DEFAULT 1,
  "lastMessageSequence" INTEGER,
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessagingConversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessagingConversation_pair_check" CHECK ("participantLowId" < "participantHighId"),
  CONSTRAINT "MessagingConversation_sequence_check" CHECK (
    "nextMessageSequence" >= 1 AND
    ("lastMessageSequence" IS NULL OR "lastMessageSequence" >= 1) AND
    ("lastMessageSequence" IS NULL OR "nextMessageSequence" > "lastMessageSequence")
  ),
  CONSTRAINT "MessagingConversation_context_check" CHECK (
    ("contextType" = 'APPLICATION' AND "applicationId" = "contextReference" AND "companyId" IS NOT NULL AND "professionalConnectionId" IS NULL)
    OR
    ("contextType" = 'PROFESSIONAL_CONNECTION' AND "professionalConnectionId" = "contextReference" AND "applicationId" IS NULL AND "companyId" IS NULL)
  )
);

CREATE TABLE "MessagingConversationParticipant" (
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadSequence" INTEGER NOT NULL DEFAULT 0,
  "lastReadAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessagingConversationParticipant_pkey" PRIMARY KEY ("conversationId", "userId"),
  CONSTRAINT "MessagingParticipant_read_sequence_check" CHECK ("lastReadSequence" >= 0)
);

CREATE TABLE "MessagingMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "senderId" TEXT NOT NULL,
  "clientOperationId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessagingMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessagingMessage_sequence_check" CHECK ("sequence" >= 1),
  CONSTRAINT "MessagingMessage_content_check" CHECK (char_length("content") BETWEEN 1 AND 2000)
);

CREATE TABLE "UserMessagingBlock" (
  "blockerUserId" TEXT NOT NULL,
  "blockedUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserMessagingBlock_pkey" PRIMARY KEY ("blockerUserId", "blockedUserId"),
  CONSTRAINT "UserMessagingBlock_pair_check" CHECK ("blockerUserId" <> "blockedUserId")
);

CREATE TABLE "MessagingReport" (
  "id" TEXT NOT NULL,
  "reporterUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "targetType" "MessagingReportTargetType" NOT NULL,
  "evidenceMessageId" TEXT,
  "category" "ModerationReportCategory" NOT NULL,
  "normalizedDetail" TEXT,
  "state" "ModerationReportState" NOT NULL DEFAULT 'PENDING_REVIEW',
  "unresolvedKey" TEXT,
  "handledAt" TIMESTAMP(3),
  "preserveUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessagingReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessagingReport_participant_check" CHECK ("reporterUserId" <> "targetUserId"),
  CONSTRAINT "MessagingReport_detail_check" CHECK ("normalizedDetail" IS NULL OR char_length("normalizedDetail") <= 500),
  CONSTRAINT "MessagingReport_hold_check" CHECK (
    ("handledAt" IS NULL AND "preserveUntil" IS NULL)
    OR
    ("handledAt" IS NOT NULL AND "preserveUntil" >= "handledAt" + INTERVAL '90 days')
  )
);

CREATE UNIQUE INDEX "ProfessionalConnection_pair_key"
  ON "ProfessionalConnection"("participantLowId", "participantHighId");
CREATE INDEX "ProfessionalConnection_reverse_state_idx"
  ON "ProfessionalConnection"("participantHighId", "participantLowId", "state");

CREATE UNIQUE INDEX "MessagingConversation_pair_context_key"
  ON "MessagingConversation"("participantLowId", "participantHighId", "contextType", "contextReference");
CREATE INDEX "MessagingConversation_low_activity_idx"
  ON "MessagingConversation"("participantLowId", "lastMessageAt" DESC, "id");
CREATE INDEX "MessagingConversation_high_activity_idx"
  ON "MessagingConversation"("participantHighId", "lastMessageAt" DESC, "id");
CREATE INDEX "MessagingConversation_applicationId_idx" ON "MessagingConversation"("applicationId");
CREATE INDEX "MessagingConversation_companyId_idx" ON "MessagingConversation"("companyId");
CREATE INDEX "MessagingConversation_connectionId_idx" ON "MessagingConversation"("professionalConnectionId");

CREATE INDEX "MessagingParticipant_user_activity_idx"
  ON "MessagingConversationParticipant"("userId", "updatedAt" DESC);

CREATE UNIQUE INDEX "MessagingMessage_conversation_sequence_key"
  ON "MessagingMessage"("conversationId", "sequence");
CREATE UNIQUE INDEX "MessagingMessage_sender_operation_key"
  ON "MessagingMessage"("senderId", "clientOperationId");
CREATE INDEX "MessagingMessage_history_idx"
  ON "MessagingMessage"("conversationId", "sequence" DESC);

CREATE INDEX "UserMessagingBlock_reverse_idx"
  ON "UserMessagingBlock"("blockedUserId", "blockerUserId");

CREATE UNIQUE INDEX "MessagingReport_unresolvedKey_key" ON "MessagingReport"("unresolvedKey");
CREATE INDEX "MessagingReport_reporter_created_idx" ON "MessagingReport"("reporterUserId", "createdAt" DESC);
CREATE INDEX "MessagingReport_conversation_state_idx" ON "MessagingReport"("conversationId", "state", "createdAt");
CREATE INDEX "MessagingReport_preserveUntil_idx" ON "MessagingReport"("preserveUntil");

ALTER TABLE "ProfessionalConnection"
  ADD CONSTRAINT "ProfessionalConnection_low_fkey" FOREIGN KEY ("participantLowId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProfessionalConnection_high_fkey" FOREIGN KEY ("participantHighId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MessagingConversation"
  ADD CONSTRAINT "MessagingConversation_low_fkey" FOREIGN KEY ("participantLowId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MessagingConversation_high_fkey" FOREIGN KEY ("participantHighId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MessagingConversation_application_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MessagingConversation_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MessagingConversation_connection_fkey" FOREIGN KEY ("professionalConnectionId") REFERENCES "ProfessionalConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MessagingConversationParticipant"
  ADD CONSTRAINT "MessagingParticipant_conversation_fkey" FOREIGN KEY ("conversationId") REFERENCES "MessagingConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MessagingParticipant_user_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MessagingMessage"
  ADD CONSTRAINT "MessagingMessage_conversation_fkey" FOREIGN KEY ("conversationId") REFERENCES "MessagingConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MessagingMessage_sender_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserMessagingBlock"
  ADD CONSTRAINT "UserMessagingBlock_blocker_fkey" FOREIGN KEY ("blockerUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "UserMessagingBlock_blocked_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MessagingReport"
  ADD CONSTRAINT "MessagingReport_reporter_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MessagingReport_target_fkey" FOREIGN KEY ("targetUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MessagingReport_conversation_fkey" FOREIGN KEY ("conversationId") REFERENCES "MessagingConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MessagingReport_evidence_fkey" FOREIGN KEY ("evidenceMessageId") REFERENCES "MessagingMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
