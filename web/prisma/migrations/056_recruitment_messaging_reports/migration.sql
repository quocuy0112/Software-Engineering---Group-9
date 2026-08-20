ALTER TABLE "MessagingReport"
  ALTER COLUMN "conversationId" DROP NOT NULL,
  ADD COLUMN "recruitmentThreadId" TEXT,
  ADD COLUMN "recruitmentEvidenceMessageId" TEXT;

ALTER TABLE "MessagingReport"
  ADD CONSTRAINT "MessagingReport_recruitmentThreadId_fkey"
  FOREIGN KEY ("recruitmentThreadId") REFERENCES "RecruitmentThread"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MessagingReport_recruitmentEvidenceMessageId_fkey"
  FOREIGN KEY ("recruitmentEvidenceMessageId") REFERENCES "RecruitmentMessage"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MessagingReport_recruitmentThreadId_state_createdAt_idx"
  ON "MessagingReport"("recruitmentThreadId", "state", "createdAt");
