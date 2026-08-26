-- Candidate professional-profile visibility is default deny. Existing rows need
-- no backfill because absence of a policy is interpreted as fully hidden.
CREATE TABLE "CandidateProfileVisibility" (
  "candidateUserId" TEXT NOT NULL,
  "discoverableByExactId" BOOLEAN NOT NULL DEFAULT false,
  "candidateSections" JSONB NOT NULL DEFAULT '[]',
  "recruiterSections" JSONB NOT NULL DEFAULT '[]',
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateProfileVisibility_pkey" PRIMARY KEY ("candidateUserId"),
  CONSTRAINT "CandidateProfileVisibility_candidateUserId_fkey"
    FOREIGN KEY ("candidateUserId") REFERENCES "CandidateIdentity"("userId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CandidateProfileVisibility_discoverableByExactId_candidateUserId_idx"
  ON "CandidateProfileVisibility"("discoverableByExactId", "candidateUserId");

CREATE TABLE "JobApplicationContactConsent" (
  "applicationId" TEXT NOT NULL,
  "sharedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobApplicationContactConsent_pkey" PRIMARY KEY ("applicationId"),
  CONSTRAINT "JobApplicationContactConsent_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "JobApplicationContactConsent_sharedAt_withdrawnAt_idx"
  ON "JobApplicationContactConsent"("sharedAt", "withdrawnAt");

ALTER TABLE "JobApplication"
  ADD COLUMN "profileSnapshotReviewDueAt" TIMESTAMP(3),
  ADD COLUMN "profileSnapshotAccessDeniedAt" TIMESTAMP(3);

-- Existing application snapshots remain accessible until a separately reviewed
-- retention migration/backfill schedules their deadline. New submissions set a
-- deadline transactionally at creation time.
CREATE INDEX "JobApplication_profileSnapshotAccessDeniedAt_profileSnapshotReviewDueAt_idx"
  ON "JobApplication"("profileSnapshotAccessDeniedAt", "profileSnapshotReviewDueAt");
