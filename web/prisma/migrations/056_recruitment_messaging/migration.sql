CREATE TYPE "RecruitmentThreadState" AS ENUM ('OPEN', 'READ_ONLY');

CREATE TABLE "RecruitmentThread" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "jobPostingId" TEXT NOT NULL,
  "candidateUserId" TEXT NOT NULL,
  "assignedMembershipId" TEXT,
  "state" "RecruitmentThreadState" NOT NULL DEFAULT 'OPEN',
  "nextMessageSequence" INTEGER NOT NULL DEFAULT 1,
  "lastMessageSequence" INTEGER,
  "lastMessageAt" TIMESTAMP(3),
  "candidateLastReadSequence" INTEGER NOT NULL DEFAULT 0,
  "staffLastReadSequence" INTEGER NOT NULL DEFAULT 0,
  "candidateLastReadAt" TIMESTAMP(3),
  "staffLastReadAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentThread_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecruitmentThread_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecruitmentThread_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RecruitmentThread_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RecruitmentThread_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RecruitmentThread_assignedMembershipId_fkey" FOREIGN KEY ("assignedMembershipId") REFERENCES "CompanyMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "RecruitmentMessage" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "senderUserId" TEXT NOT NULL,
  "senderMembershipId" TEXT,
  "clientOperationId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecruitmentMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "RecruitmentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecruitmentMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RecruitmentThread_applicationId_key" ON "RecruitmentThread"("applicationId");
CREATE INDEX "RecruitmentThread_companyId_lastMessageAt_id_idx" ON "RecruitmentThread"("companyId", "lastMessageAt" DESC, "id");
CREATE INDEX "RecruitmentThread_jobPostingId_lastMessageAt_id_idx" ON "RecruitmentThread"("jobPostingId", "lastMessageAt" DESC, "id");
CREATE INDEX "RecruitmentThread_assignedMembershipId_lastMessageAt_id_idx" ON "RecruitmentThread"("assignedMembershipId", "lastMessageAt" DESC, "id");
CREATE INDEX "RecruitmentThread_candidateUserId_lastMessageAt_id_idx" ON "RecruitmentThread"("candidateUserId", "lastMessageAt" DESC, "id");
CREATE INDEX "RecruitmentThread_state_lastMessageAt_id_idx" ON "RecruitmentThread"("state", "lastMessageAt" DESC, "id");
CREATE UNIQUE INDEX "RecruitmentMessage_threadId_sequence_key" ON "RecruitmentMessage"("threadId", "sequence");
CREATE UNIQUE INDEX "RecruitmentMessage_senderUserId_clientOperationId_key" ON "RecruitmentMessage"("senderUserId", "clientOperationId");
CREATE INDEX "RecruitmentMessage_threadId_sequence_idx" ON "RecruitmentMessage"("threadId", "sequence" DESC);
