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
ALTER INDEX "ProfessionalConnection_pair_key" RENAME TO "ProfessionalConnection_participantLowId_participantHighId_key";

-- RenameIndex
ALTER INDEX "ProfessionalConnection_reverse_state_idx" RENAME TO "ProfessionalConnection_participantHighId_participantLowId_s_idx";

-- RenameIndex
ALTER INDEX "UserMessagingBlock_reverse_idx" RENAME TO "UserMessagingBlock_blockedUserId_blockerUserId_idx";
