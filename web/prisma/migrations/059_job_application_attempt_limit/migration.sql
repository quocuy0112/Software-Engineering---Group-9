-- Allow a candidate to submit a new application after withdrawing or being
-- rejected while retaining every application attempt and its audit history.

CREATE TABLE "JobApplicationAttemptCounter" (
  "id" TEXT NOT NULL,
  "candidateUserId" TEXT NOT NULL,
  "jobPostingId" TEXT NOT NULL,
  "applicationCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobApplicationAttemptCounter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JobApplicationAttemptCounter_applicationCount_check"
    CHECK ("applicationCount" BETWEEN 0 AND 5)
);

INSERT INTO "JobApplicationAttemptCounter" (
  "id",
  "candidateUserId",
  "jobPostingId",
  "applicationCount",
  "createdAt",
  "updatedAt"
)
SELECT
  'application-attempt-counter-' || md5(application."candidateUserId" || ':' || application."jobPostingId"),
  application."candidateUserId",
  application."jobPostingId",
  COUNT(*)::INTEGER,
  MIN(application."createdAt"),
  MAX(application."updatedAt")
FROM "JobApplication" AS application
GROUP BY application."candidateUserId", application."jobPostingId";

ALTER TABLE "JobApplication"
  ADD COLUMN "applicationAttemptNumber" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "JobApplication_applicationAttemptNumber_check"
    CHECK ("applicationAttemptNumber" BETWEEN 1 AND 5);

DROP INDEX "JobApplication_candidateUserId_jobPostingId_key";

CREATE UNIQUE INDEX "JobApplication_candidateUserId_jobPostingId_applicationAttemptNumber_key"
  ON "JobApplication" ("candidateUserId", "jobPostingId", "applicationAttemptNumber");

CREATE UNIQUE INDEX "JobApplicationAttemptCounter_candidateUserId_jobPostingId_key"
  ON "JobApplicationAttemptCounter" ("candidateUserId", "jobPostingId");

CREATE INDEX "JobApplicationAttemptCounter_jobPostingId_applicationCount_idx"
  ON "JobApplicationAttemptCounter" ("jobPostingId", "applicationCount");

ALTER TABLE "JobApplicationAttemptCounter"
  ADD CONSTRAINT "JobApplicationAttemptCounter_candidateUserId_fkey"
    FOREIGN KEY ("candidateUserId") REFERENCES "CandidateIdentity"("userId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "JobApplicationAttemptCounter_jobPostingId_fkey"
    FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
