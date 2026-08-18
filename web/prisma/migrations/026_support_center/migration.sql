CREATE TYPE "SupportConversationCategory" AS ENUM ('ACCOUNT_ACCESS', 'PROFILE', 'JOBS_APPLICATIONS', 'RECRUITER', 'MESSAGING', 'PRIVACY_SAFETY', 'OTHER');
CREATE TYPE "SupportConversationState" AS ENUM ('OPEN', 'WAITING_FOR_USER', 'WAITING_FOR_SUPPORT', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportMessageSenderKind" AS ENUM ('REQUESTER', 'ADMINISTRATOR');
CREATE TYPE "SupportAssignmentEndReason" AS ENUM ('REASSIGNED', 'AUTHORITY_LOST', 'CASE_CLOSED');

ALTER TYPE "EmailKind" ADD VALUE 'SUPPORT_CASE_UPDATED';

CREATE TABLE "SupportConversation" (
  "id" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "category" "SupportConversationCategory" NOT NULL,
  "subject" VARCHAR(120) NOT NULL,
  "state" "SupportConversationState" NOT NULL DEFAULT 'OPEN',
  "version" INTEGER NOT NULL DEFAULT 1,
  "nextMessageSequence" INTEGER NOT NULL DEFAULT 1,
  "lastMessageAt" TIMESTAMP(3),
  "currentAssigneeUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "contentDeleteAfter" TIMESTAMP(3),
  "contentDeletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "senderKind" "SupportMessageSenderKind" NOT NULL,
  "senderUserId" TEXT NOT NULL,
  "clientOperationId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportAssignment" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "assigneeAdminUserId" TEXT NOT NULL,
  "assignedByAdminUserId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "endReason" "SupportAssignmentEndReason",
  CONSTRAINT "SupportAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportInternalNote" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "authorAdminUserId" TEXT NOT NULL,
  "normalizedText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportInternalNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportConversationHistory" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" VARCHAR(80) NOT NULL,
  "priorState" "SupportConversationState",
  "resultingState" "SupportConversationState" NOT NULL,
  "resultingVersion" INTEGER NOT NULL,
  "assignmentReason" VARCHAR(80),
  "priorAssigneeUserId" TEXT,
  "resultingAssigneeUserId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportConversationHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EmailOutbox" ADD COLUMN "supportConversationId" TEXT;

CREATE INDEX "SupportConversation_requesterUserId_updatedAt_id_idx" ON "SupportConversation"("requesterUserId", "updatedAt" DESC, "id");
CREATE INDEX "SupportConversation_state_updatedAt_id_idx" ON "SupportConversation"("state", "updatedAt", "id");
CREATE INDEX "SupportConversation_currentAssigneeUserId_state_updatedAt_idx" ON "SupportConversation"("currentAssigneeUserId", "state", "updatedAt");
CREATE INDEX "SupportConversation_contentDeleteAfter_contentDeletedAt_idx" ON "SupportConversation"("contentDeleteAfter", "contentDeletedAt");
CREATE UNIQUE INDEX "SupportMessage_conversationId_sequence_key" ON "SupportMessage"("conversationId", "sequence");
CREATE UNIQUE INDEX "SupportMessage_senderUserId_clientOperationId_key" ON "SupportMessage"("senderUserId", "clientOperationId");
CREATE INDEX "SupportMessage_conversationId_sequence_idx" ON "SupportMessage"("conversationId", "sequence" DESC);
CREATE INDEX "SupportAssignment_conversationId_assignedAt_idx" ON "SupportAssignment"("conversationId", "assignedAt" DESC);
CREATE INDEX "SupportAssignment_assigneeAdminUserId_endedAt_idx" ON "SupportAssignment"("assigneeAdminUserId", "endedAt");
CREATE UNIQUE INDEX "SupportAssignment_one_active_per_case" ON "SupportAssignment"("conversationId") WHERE "endedAt" IS NULL;
CREATE INDEX "SupportInternalNote_conversationId_createdAt_idx" ON "SupportInternalNote"("conversationId", "createdAt");
CREATE INDEX "SupportConversationHistory_conversationId_occurredAt_idx" ON "SupportConversationHistory"("conversationId", "occurredAt");
CREATE INDEX "EmailOutbox_supportConversationId_kind_idx" ON "EmailOutbox"("supportConversationId", "kind");

ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_currentAssigneeUserId_fkey" FOREIGN KEY ("currentAssigneeUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportAssignment" ADD CONSTRAINT "SupportAssignment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportAssignment" ADD CONSTRAINT "SupportAssignment_assigneeAdminUserId_fkey" FOREIGN KEY ("assigneeAdminUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportAssignment" ADD CONSTRAINT "SupportAssignment_assignedByAdminUserId_fkey" FOREIGN KEY ("assignedByAdminUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportInternalNote" ADD CONSTRAINT "SupportInternalNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportInternalNote" ADD CONSTRAINT "SupportInternalNote_authorAdminUserId_fkey" FOREIGN KEY ("authorAdminUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportConversationHistory" ADD CONSTRAINT "SupportConversationHistory_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_supportConversationId_fkey" FOREIGN KEY ("supportConversationId") REFERENCES "SupportConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
