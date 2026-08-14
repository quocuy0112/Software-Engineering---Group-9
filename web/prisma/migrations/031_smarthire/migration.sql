/*
  Warnings:

  - A unique constraint covering the columns `[sourceProposalId]` on the table `ProfessionalConnection` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProfessionalConnectionProposalState" AS ENUM ('PENDING_BOTH', 'PARTIALLY_ACCEPTED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProfessionalConnectionDecisionKind" AS ENUM ('ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ProfessionalConnectionNotificationKind" AS ENUM ('PROPOSAL_CREATED', 'PROPOSAL_UPDATED', 'PROPOSAL_NO_LONGER_ACTIVE', 'CONNECTION_ACCEPTED', 'CONNECTION_REVOKED');

-- CreateEnum
CREATE TYPE "MessagingConversationArchiveReason" AS ENUM ('PROFESSIONAL_CONNECTION_REVOKED');

-- CreateEnum
CREATE TYPE "SupportConversationCategory" AS ENUM ('ACCOUNT_ACCESS', 'PROFILE', 'JOBS_APPLICATIONS', 'RECRUITER', 'MESSAGING', 'PRIVACY_SAFETY', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportConversationState" AS ENUM ('OPEN', 'WAITING_FOR_USER', 'WAITING_FOR_SUPPORT', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportMessageSenderKind" AS ENUM ('REQUESTER', 'ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "SupportAssignmentEndReason" AS ENUM ('REASSIGNED', 'AUTHORITY_LOST', 'CASE_CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailKind" ADD VALUE 'SUPPORT_CASE_UPDATED';
ALTER TYPE "EmailKind" ADD VALUE 'PROFESSIONAL_CONNECTION_UPDATED';

-- AlterEnum
ALTER TYPE "ProfessionalConnectionStatus" ADD VALUE 'REVOKED';

-- DropIndex
DROP INDEX "ProfessionalConnection_pair_key";

-- AlterTable
ALTER TABLE "EmailOutbox" ADD COLUMN     "professionalConnectionId" TEXT,
ADD COLUMN     "professionalConnectionProposalId" TEXT,
ADD COLUMN     "supportConversationId" TEXT;

-- AlterTable
ALTER TABLE "MessagingConversation" ADD COLUMN     "archiveReason" "MessagingConversationArchiveReason",
ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProfessionalConnection" ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedByUserId" TEXT,
ADD COLUMN     "sourceProposalId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ProfessionalConnectionProposal" (
    "id" TEXT NOT NULL,
    "participantLowId" TEXT,
    "participantHighId" TEXT,
    "participantPairDigest" VARCHAR(128) NOT NULL,
    "createdByAdminUserId" TEXT,
    "sourceSupportConversationId" TEXT,
    "reason" VARCHAR(500),
    "state" "ProfessionalConnectionProposalState" NOT NULL DEFAULT 'PENDING_BOTH',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "terminalAt" TIMESTAMP(3),
    "ordinaryDetailHiddenAt" TIMESTAMP(3),
    "protectedDeleteAfter" TIMESTAMP(3),
    "protectedDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalConnectionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalConnectionDecision" (
    "proposalId" TEXT NOT NULL,
    "participantUserId" TEXT NOT NULL,
    "decision" "ProfessionalConnectionDecisionKind" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalConnectionDecision_pkey" PRIMARY KEY ("proposalId","participantUserId")
);

-- CreateTable
CREATE TABLE "ProfessionalConnectionProposalHistory" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" VARCHAR(80) NOT NULL,
    "priorState" "ProfessionalConnectionProposalState",
    "resultingState" "ProfessionalConnectionProposalState" NOT NULL,
    "resultingVersion" INTEGER NOT NULL,
    "decisionKind" "ProfessionalConnectionDecisionKind",
    "correlationId" VARCHAR(128) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalConnectionProposalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalConnectionNotification" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "proposalId" TEXT,
    "connectionId" TEXT,
    "kind" "ProfessionalConnectionNotificationKind" NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "deleteAfter" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalConnectionNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalConnectionCommandReceipt" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "commandKind" VARCHAR(80) NOT NULL,
    "targetReference" VARCHAR(128),
    "payloadDigest" VARCHAR(128) NOT NULL,
    "resultReference" VARCHAR(128),
    "resultState" VARCHAR(80),
    "resultVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalConnectionCommandReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "SupportInternalNote" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorAdminUserId" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportInternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE INDEX "ProfessionalConnectionProposal_participantLowId_state_expir_idx" ON "ProfessionalConnectionProposal"("participantLowId", "state", "expiresAt", "id");

-- CreateIndex
CREATE INDEX "ProfessionalConnectionProposal_participantHighId_state_expi_idx" ON "ProfessionalConnectionProposal"("participantHighId", "state", "expiresAt", "id");

-- CreateIndex
CREATE INDEX "ProfessionalConnectionProposal_createdByAdminUserId_created_idx" ON "ProfessionalConnectionProposal"("createdByAdminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfessionalConnectionProposal_participantLowId_participant_idx" ON "ProfessionalConnectionProposal"("participantLowId", "participantHighId", "terminalAt");

-- CreateIndex
CREATE INDEX "ProfessionalConnectionProposal_expiresAt_state_idx" ON "ProfessionalConnectionProposal"("expiresAt", "state");

-- CreateIndex
CREATE INDEX "ProfessionalConnectionProposal_protectedDeleteAfter_protect_idx" ON "ProfessionalConnectionProposal"("protectedDeleteAfter", "protectedDeletedAt");

-- CreateIndex
CREATE INDEX "ProfessionalConnectionDecision_participantUserId_decidedAt_idx" ON "ProfessionalConnectionDecision"("participantUserId", "decidedAt");

-- CreateIndex
CREATE INDEX "ProfessionalConnectionProposalHistory_proposalId_occurredAt_idx" ON "ProfessionalConnectionProposalHistory"("proposalId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "ProfessionalConnectionProposalHistory_correlationId_idx" ON "ProfessionalConnectionProposalHistory"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalConnectionNotification_deduplicationKey_key" ON "ProfessionalConnectionNotification"("deduplicationKey");

-- CreateIndex
CREATE INDEX "ProfessionalConnectionNotification_recipientUserId_createdA_idx" ON "ProfessionalConnectionNotification"("recipientUserId", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "ProfessionalConnectionNotification_deleteAfter_idx" ON "ProfessionalConnectionNotification"("deleteAfter");

-- CreateIndex
CREATE INDEX "ProfessionalConnectionCommandReceipt_targetReference_create_idx" ON "ProfessionalConnectionCommandReceipt"("targetReference", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalConnectionCommandReceipt_actorUserId_idempotenc_key" ON "ProfessionalConnectionCommandReceipt"("actorUserId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SupportConversation_requesterUserId_updatedAt_id_idx" ON "SupportConversation"("requesterUserId", "updatedAt" DESC, "id");

-- CreateIndex
CREATE INDEX "SupportConversation_state_updatedAt_id_idx" ON "SupportConversation"("state", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "SupportConversation_currentAssigneeUserId_state_updatedAt_idx" ON "SupportConversation"("currentAssigneeUserId", "state", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportConversation_contentDeleteAfter_contentDeletedAt_idx" ON "SupportConversation"("contentDeleteAfter", "contentDeletedAt");

-- CreateIndex
CREATE INDEX "SupportMessage_conversationId_sequence_idx" ON "SupportMessage"("conversationId", "sequence" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SupportMessage_conversationId_sequence_key" ON "SupportMessage"("conversationId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "SupportMessage_senderUserId_clientOperationId_key" ON "SupportMessage"("senderUserId", "clientOperationId");

-- CreateIndex
CREATE INDEX "SupportAssignment_conversationId_assignedAt_idx" ON "SupportAssignment"("conversationId", "assignedAt" DESC);

-- CreateIndex
CREATE INDEX "SupportAssignment_assigneeAdminUserId_endedAt_idx" ON "SupportAssignment"("assigneeAdminUserId", "endedAt");

-- CreateIndex
CREATE INDEX "SupportInternalNote_conversationId_createdAt_idx" ON "SupportInternalNote"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportConversationHistory_conversationId_occurredAt_idx" ON "SupportConversationHistory"("conversationId", "occurredAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_supportConversationId_kind_idx" ON "EmailOutbox"("supportConversationId", "kind");

-- CreateIndex
CREATE INDEX "EmailOutbox_professionalConnectionProposalId_kind_idx" ON "EmailOutbox"("professionalConnectionProposalId", "kind");

-- CreateIndex
CREATE INDEX "EmailOutbox_professionalConnectionId_kind_idx" ON "EmailOutbox"("professionalConnectionId", "kind");

-- CreateIndex
CREATE INDEX "MessagingConversation_archivedAt_archiveReason_idx" ON "MessagingConversation"("archivedAt", "archiveReason");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalConnection_sourceProposalId_key" ON "ProfessionalConnection"("sourceProposalId");

-- CreateIndex
CREATE INDEX "user_name_trgm_idx" ON "user" USING GIN ("name" gin_trgm_ops);

-- RenameForeignKey
ALTER TABLE "MessagingConversation" RENAME CONSTRAINT "MessagingConversation_application_fkey" TO "MessagingConversation_applicationId_fkey";

-- RenameForeignKey
ALTER TABLE "MessagingConversation" RENAME CONSTRAINT "MessagingConversation_company_fkey" TO "MessagingConversation_companyId_fkey";

-- RenameForeignKey
ALTER TABLE "MessagingConversation" RENAME CONSTRAINT "MessagingConversation_connection_fkey" TO "MessagingConversation_professionalConnectionId_fkey";

-- RenameForeignKey
ALTER TABLE "MessagingConversation" RENAME CONSTRAINT "MessagingConversation_high_fkey" TO "MessagingConversation_participantHighId_fkey";

-- RenameForeignKey
ALTER TABLE "MessagingConversation" RENAME CONSTRAINT "MessagingConversation_low_fkey" TO "MessagingConversation_participantLowId_fkey";

-- RenameForeignKey
ALTER TABLE "MessagingConversationParticipant" RENAME CONSTRAINT "MessagingParticipant_conversation_fkey" TO "MessagingConversationParticipant_conversationId_fkey";

-- RenameForeignKey
ALTER TABLE "MessagingConversationParticipant" RENAME CONSTRAINT "MessagingParticipant_user_fkey" TO "MessagingConversationParticipant_userId_fkey";

-- RenameForeignKey
ALTER TABLE "MessagingMessage" RENAME CONSTRAINT "MessagingMessage_conversation_fkey" TO "MessagingMessage_conversationId_fkey";

-- RenameForeignKey
ALTER TABLE "MessagingMessage" RENAME CONSTRAINT "MessagingMessage_sender_fkey" TO "MessagingMessage_senderId_fkey";

-- RenameForeignKey
ALTER TABLE "MessagingReport" RENAME CONSTRAINT "MessagingReport_conversation_fkey" TO "MessagingReport_conversationId_fkey";

-- RenameForeignKey
ALTER TABLE "MessagingReport" RENAME CONSTRAINT "MessagingReport_evidence_fkey" TO "MessagingReport_evidenceMessageId_fkey";

-- RenameForeignKey
ALTER TABLE "MessagingReport" RENAME CONSTRAINT "MessagingReport_reporter_fkey" TO "MessagingReport_reporterUserId_fkey";

-- RenameForeignKey
ALTER TABLE "MessagingReport" RENAME CONSTRAINT "MessagingReport_target_fkey" TO "MessagingReport_targetUserId_fkey";

-- RenameForeignKey
ALTER TABLE "ProfessionalConnection" RENAME CONSTRAINT "ProfessionalConnection_high_fkey" TO "ProfessionalConnection_participantHighId_fkey";

-- RenameForeignKey
ALTER TABLE "ProfessionalConnection" RENAME CONSTRAINT "ProfessionalConnection_low_fkey" TO "ProfessionalConnection_participantLowId_fkey";

-- RenameForeignKey
ALTER TABLE "UserMessagingBlock" RENAME CONSTRAINT "UserMessagingBlock_blocked_fkey" TO "UserMessagingBlock_blockedUserId_fkey";

-- RenameForeignKey
ALTER TABLE "UserMessagingBlock" RENAME CONSTRAINT "UserMessagingBlock_blocker_fkey" TO "UserMessagingBlock_blockerUserId_fkey";

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_supportConversationId_fkey" FOREIGN KEY ("supportConversationId") REFERENCES "SupportConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_professionalConnectionProposalId_fkey" FOREIGN KEY ("professionalConnectionProposalId") REFERENCES "ProfessionalConnectionProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_professionalConnectionId_fkey" FOREIGN KEY ("professionalConnectionId") REFERENCES "ProfessionalConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalConnection" ADD CONSTRAINT "ProfessionalConnection_sourceProposalId_fkey" FOREIGN KEY ("sourceProposalId") REFERENCES "ProfessionalConnectionProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalConnection" ADD CONSTRAINT "ProfessionalConnection_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalConnectionProposal" ADD CONSTRAINT "ProfessionalConnectionProposal_participantLowId_fkey" FOREIGN KEY ("participantLowId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalConnectionProposal" ADD CONSTRAINT "ProfessionalConnectionProposal_participantHighId_fkey" FOREIGN KEY ("participantHighId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalConnectionProposal" ADD CONSTRAINT "ProfessionalConnectionProposal_createdByAdminUserId_fkey" FOREIGN KEY ("createdByAdminUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalConnectionProposal" ADD CONSTRAINT "ProfessionalConnectionProposal_sourceSupportConversationId_fkey" FOREIGN KEY ("sourceSupportConversationId") REFERENCES "SupportConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalConnectionDecision" ADD CONSTRAINT "ProfessionalConnectionDecision_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ProfessionalConnectionProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalConnectionDecision" ADD CONSTRAINT "ProfessionalConnectionDecision_participantUserId_fkey" FOREIGN KEY ("participantUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalConnectionProposalHistory" ADD CONSTRAINT "ProfessionalConnectionProposalHistory_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ProfessionalConnectionProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalConnectionProposalHistory" ADD CONSTRAINT "ProfessionalConnectionProposalHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalConnectionNotification" ADD CONSTRAINT "ProfessionalConnectionNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalConnectionNotification" ADD CONSTRAINT "ProfessionalConnectionNotification_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ProfessionalConnectionProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalConnectionNotification" ADD CONSTRAINT "ProfessionalConnectionNotification_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProfessionalConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalConnectionCommandReceipt" ADD CONSTRAINT "ProfessionalConnectionCommandReceipt_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_currentAssigneeUserId_fkey" FOREIGN KEY ("currentAssigneeUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAssignment" ADD CONSTRAINT "SupportAssignment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAssignment" ADD CONSTRAINT "SupportAssignment_assigneeAdminUserId_fkey" FOREIGN KEY ("assigneeAdminUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAssignment" ADD CONSTRAINT "SupportAssignment_assignedByAdminUserId_fkey" FOREIGN KEY ("assignedByAdminUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportInternalNote" ADD CONSTRAINT "SupportInternalNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportInternalNote" ADD CONSTRAINT "SupportInternalNote_authorAdminUserId_fkey" FOREIGN KEY ("authorAdminUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversationHistory" ADD CONSTRAINT "SupportConversationHistory_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "MessagingConversation_connectionId_idx" RENAME TO "MessagingConversation_professionalConnectionId_idx";

-- RenameIndex
ALTER INDEX "MessagingConversation_high_activity_idx" RENAME TO "MessagingConversation_participantHighId_lastMessageAt_id_idx";

-- RenameIndex
ALTER INDEX "MessagingConversation_low_activity_idx" RENAME TO "MessagingConversation_participantLowId_lastMessageAt_id_idx";

-- RenameIndex
ALTER INDEX "MessagingConversation_pair_context_key" RENAME TO "MessagingConversation_participantLowId_participantHighId_co_key";

-- RenameIndex
ALTER INDEX "MessagingParticipant_user_activity_idx" RENAME TO "MessagingConversationParticipant_userId_updatedAt_idx";

-- RenameIndex
ALTER INDEX "MessagingMessage_conversation_sequence_key" RENAME TO "MessagingMessage_conversationId_sequence_key";

-- RenameIndex
ALTER INDEX "MessagingMessage_history_idx" RENAME TO "MessagingMessage_conversationId_sequence_idx";

-- RenameIndex
ALTER INDEX "MessagingMessage_sender_operation_key" RENAME TO "MessagingMessage_senderId_clientOperationId_key";

-- RenameIndex
ALTER INDEX "MessagingReport_conversation_state_idx" RENAME TO "MessagingReport_conversationId_state_createdAt_idx";

-- RenameIndex
ALTER INDEX "MessagingReport_reporter_created_idx" RENAME TO "MessagingReport_reporterUserId_createdAt_idx";

-- RenameIndex
ALTER INDEX "ProfessionalConnection_reverse_state_idx" RENAME TO "ProfessionalConnection_participantHighId_participantLowId_s_idx";

-- RenameIndex
ALTER INDEX "UserMessagingBlock_reverse_idx" RENAME TO "UserMessagingBlock_blockedUserId_blockerUserId_idx";
