ALTER TABLE "AdminCommandReceipt"
ADD COLUMN "resultPayload" JSONB;

ALTER TABLE "MessagingReport"
ADD COLUMN "assignedAdminUserId" TEXT,
ADD COLUMN "handledByAdminUserId" TEXT,
ADD COLUMN "enforcementCorrelationId" VARCHAR(128),
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "MessagingReportReviewEvent" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "actorAdminUserId" TEXT NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "priorState" "ModerationReportState" NOT NULL,
  "resultingState" "ModerationReportState" NOT NULL,
  "resultingVersion" INTEGER NOT NULL,
  "enforcementCorrelationId" VARCHAR(128),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessagingReportReviewEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessagingReportPrivateNote" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "authorAdminUserId" TEXT NOT NULL,
  "normalizedText" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessagingReportPrivateNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MessagingReport_state_createdAt_id_idx" ON "MessagingReport"("state", "createdAt", "id");
CREATE INDEX "MessagingReport_assignedAdminUserId_state_createdAt_id_idx" ON "MessagingReport"("assignedAdminUserId", "state", "createdAt", "id");
CREATE UNIQUE INDEX "MessagingReportReviewEvent_reportId_resultingVersion_key" ON "MessagingReportReviewEvent"("reportId", "resultingVersion");
CREATE INDEX "MessagingReportReviewEvent_reportId_occurredAt_id_idx" ON "MessagingReportReviewEvent"("reportId", "occurredAt", "id");
CREATE INDEX "MessagingReportReviewEvent_actorAdminUserId_occurredAt_idx" ON "MessagingReportReviewEvent"("actorAdminUserId", "occurredAt");
CREATE INDEX "MessagingReportPrivateNote_reportId_createdAt_id_idx" ON "MessagingReportPrivateNote"("reportId", "createdAt", "id");

ALTER TABLE "MessagingReport" ADD CONSTRAINT "MessagingReport_assignedAdminUserId_fkey" FOREIGN KEY ("assignedAdminUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessagingReport" ADD CONSTRAINT "MessagingReport_handledByAdminUserId_fkey" FOREIGN KEY ("handledByAdminUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessagingReportReviewEvent" ADD CONSTRAINT "MessagingReportReviewEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MessagingReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessagingReportReviewEvent" ADD CONSTRAINT "MessagingReportReviewEvent_actorAdminUserId_fkey" FOREIGN KEY ("actorAdminUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MessagingReportPrivateNote" ADD CONSTRAINT "MessagingReportPrivateNote_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MessagingReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessagingReportPrivateNote" ADD CONSTRAINT "MessagingReportPrivateNote_authorAdminUserId_fkey" FOREIGN KEY ("authorAdminUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MessagingReport"
ADD CONSTRAINT "MessagingReport_version_check" CHECK ("version" >= 1),
ADD CONSTRAINT "MessagingReport_terminal_state_check" CHECK (
  ("state" = 'PENDING_REVIEW' AND "handledAt" IS NULL AND "handledByAdminUserId" IS NULL)
  OR ("state" IN ('RESOLVED', 'DISMISSED') AND "handledAt" IS NOT NULL AND "handledByAdminUserId" IS NOT NULL)
);
