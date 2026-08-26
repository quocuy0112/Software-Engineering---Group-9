ALTER TYPE "EmailKind" ADD VALUE IF NOT EXISTS 'PROFESSIONAL_CONNECTION_UPDATED';

ALTER TABLE "ProfessionalConnection"
  ALTER COLUMN "state" DROP DEFAULT;
CREATE TYPE "ProfessionalConnectionStatus_next" AS ENUM ('ACCEPTED', 'REVOKED');
ALTER TABLE "ProfessionalConnection"
  ALTER COLUMN "state" TYPE "ProfessionalConnectionStatus_next"
  USING ("state"::text::"ProfessionalConnectionStatus_next");
DROP TYPE "ProfessionalConnectionStatus";
ALTER TYPE "ProfessionalConnectionStatus_next"
  RENAME TO "ProfessionalConnectionStatus";
ALTER TABLE "ProfessionalConnection"
  ALTER COLUMN "state" SET DEFAULT 'ACCEPTED';

DO $$ BEGIN
  CREATE TYPE "ProfessionalConnectionProposalState" AS ENUM (
    'PENDING_BOTH', 'PARTIALLY_ACCEPTED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProfessionalConnectionDecisionKind" AS ENUM ('ACCEPTED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProfessionalConnectionNotificationKind" AS ENUM (
    'PROPOSAL_CREATED', 'PROPOSAL_UPDATED', 'PROPOSAL_NO_LONGER_ACTIVE', 'CONNECTION_ACCEPTED', 'CONNECTION_REVOKED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessagingConversationArchiveReason" AS ENUM ('PROFESSIONAL_CONNECTION_REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP INDEX "ProfessionalConnection_participantLowId_participantHighId_key";

ALTER TABLE "ProfessionalConnection"
  ADD COLUMN "sourceProposalId" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "revokedByUserId" TEXT;

ALTER TABLE "MessagingConversation"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archiveReason" "MessagingConversationArchiveReason";

ALTER TABLE "EmailOutbox"
  ADD COLUMN "professionalConnectionProposalId" TEXT,
  ADD COLUMN "professionalConnectionId" TEXT;

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
  CONSTRAINT "ProfessionalConnectionProposal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalConnectionProposal_pair_check" CHECK (
    ("participantLowId" IS NULL AND "participantHighId" IS NULL)
    OR ("participantLowId" IS NOT NULL AND "participantHighId" IS NOT NULL AND "participantLowId" < "participantHighId")
  )
);

CREATE TABLE "ProfessionalConnectionDecision" (
  "proposalId" TEXT NOT NULL,
  "participantUserId" TEXT NOT NULL,
  "decision" "ProfessionalConnectionDecisionKind" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfessionalConnectionDecision_pkey" PRIMARY KEY ("proposalId", "participantUserId")
);

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
  CONSTRAINT "ProfessionalConnectionNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalConnectionNotification_context_check" CHECK (
    "proposalId" IS NOT NULL OR "connectionId" IS NOT NULL
  )
);

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

CREATE UNIQUE INDEX "ProfessionalConnection_sourceProposalId_key"
  ON "ProfessionalConnection"("sourceProposalId");
CREATE UNIQUE INDEX "ProfessionalConnection_current_pair_key"
  ON "ProfessionalConnection"("participantLowId", "participantHighId")
  WHERE "state" = 'ACCEPTED';
CREATE UNIQUE INDEX "ProfessionalConnectionProposal_active_pair_key"
  ON "ProfessionalConnectionProposal"("participantLowId", "participantHighId")
  WHERE "state" IN ('PENDING_BOTH', 'PARTIALLY_ACCEPTED');
CREATE UNIQUE INDEX "ProfessionalConnectionNotification_deduplicationKey_key"
  ON "ProfessionalConnectionNotification"("deduplicationKey");
CREATE UNIQUE INDEX "ProfessionalConnectionCommandReceipt_actorUserId_idempotencyKey_key"
  ON "ProfessionalConnectionCommandReceipt"("actorUserId", "idempotencyKey");

CREATE INDEX "ProfessionalConnectionProposal_participantLowId_state_expiresAt_id_idx"
  ON "ProfessionalConnectionProposal"("participantLowId", "state", "expiresAt", "id");
CREATE INDEX "ProfessionalConnectionProposal_participantHighId_state_expiresAt_id_idx"
  ON "ProfessionalConnectionProposal"("participantHighId", "state", "expiresAt", "id");
CREATE INDEX "ProfessionalConnectionProposal_createdByAdminUserId_createdAt_idx"
  ON "ProfessionalConnectionProposal"("createdByAdminUserId", "createdAt");
CREATE INDEX "ProfessionalConnectionProposal_participantLowId_participantHighId_terminalAt_idx"
  ON "ProfessionalConnectionProposal"("participantLowId", "participantHighId", "terminalAt");
CREATE INDEX "ProfessionalConnectionProposal_expiresAt_state_idx"
  ON "ProfessionalConnectionProposal"("expiresAt", "state");
CREATE INDEX "ProfessionalConnectionProposal_protectedDeleteAfter_protectedDeletedAt_idx"
  ON "ProfessionalConnectionProposal"("protectedDeleteAfter", "protectedDeletedAt");
CREATE INDEX "ProfessionalConnectionDecision_participantUserId_decidedAt_idx"
  ON "ProfessionalConnectionDecision"("participantUserId", "decidedAt");
CREATE INDEX "ProfessionalConnectionProposalHistory_proposalId_occurredAt_id_idx"
  ON "ProfessionalConnectionProposalHistory"("proposalId", "occurredAt", "id");
CREATE INDEX "ProfessionalConnectionProposalHistory_correlationId_idx"
  ON "ProfessionalConnectionProposalHistory"("correlationId");
CREATE INDEX "ProfessionalConnectionNotification_recipientUserId_createdAt_id_idx"
  ON "ProfessionalConnectionNotification"("recipientUserId", "createdAt" DESC, "id");
CREATE INDEX "ProfessionalConnectionNotification_deleteAfter_idx"
  ON "ProfessionalConnectionNotification"("deleteAfter");
CREATE INDEX "ProfessionalConnectionCommandReceipt_targetReference_createdAt_idx"
  ON "ProfessionalConnectionCommandReceipt"("targetReference", "createdAt");
CREATE INDEX "MessagingConversation_archivedAt_archiveReason_idx"
  ON "MessagingConversation"("archivedAt", "archiveReason");
CREATE INDEX "EmailOutbox_professionalConnectionProposalId_kind_idx"
  ON "EmailOutbox"("professionalConnectionProposalId", "kind");
CREATE INDEX "EmailOutbox_professionalConnectionId_kind_idx"
  ON "EmailOutbox"("professionalConnectionId", "kind");

ALTER TABLE "ProfessionalConnection"
  ADD CONSTRAINT "ProfessionalConnection_revocation_check" CHECK (
    ("state" = 'ACCEPTED' AND "revokedAt" IS NULL AND "revokedByUserId" IS NULL)
    OR ("state" = 'REVOKED' AND "revokedAt" IS NOT NULL AND "revokedByUserId" IS NOT NULL)
  ),
  ADD CONSTRAINT "ProfessionalConnection_sourceProposalId_fkey"
    FOREIGN KEY ("sourceProposalId") REFERENCES "ProfessionalConnectionProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProfessionalConnection_revokedByUserId_fkey"
    FOREIGN KEY ("revokedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProfessionalConnectionProposal"
  ADD CONSTRAINT "ProfessionalConnectionProposal_participantLowId_fkey"
    FOREIGN KEY ("participantLowId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProfessionalConnectionProposal_participantHighId_fkey"
    FOREIGN KEY ("participantHighId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProfessionalConnectionProposal_createdByAdminUserId_fkey"
    FOREIGN KEY ("createdByAdminUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProfessionalConnectionProposal_sourceSupportConversationId_fkey"
    FOREIGN KEY ("sourceSupportConversationId") REFERENCES "SupportConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProfessionalConnectionDecision"
  ADD CONSTRAINT "ProfessionalConnectionDecision_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "ProfessionalConnectionProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProfessionalConnectionDecision_participantUserId_fkey"
    FOREIGN KEY ("participantUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProfessionalConnectionProposalHistory"
  ADD CONSTRAINT "ProfessionalConnectionProposalHistory_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "ProfessionalConnectionProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProfessionalConnectionProposalHistory_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProfessionalConnectionNotification"
  ADD CONSTRAINT "ProfessionalConnectionNotification_recipientUserId_fkey"
    FOREIGN KEY ("recipientUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProfessionalConnectionNotification_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "ProfessionalConnectionProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProfessionalConnectionNotification_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "ProfessionalConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProfessionalConnectionCommandReceipt"
  ADD CONSTRAINT "ProfessionalConnectionCommandReceipt_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmailOutbox"
  ADD CONSTRAINT "EmailOutbox_professionalConnectionProposalId_fkey"
    FOREIGN KEY ("professionalConnectionProposalId") REFERENCES "ProfessionalConnectionProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "EmailOutbox_professionalConnectionId_fkey"
    FOREIGN KEY ("professionalConnectionId") REFERENCES "ProfessionalConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
