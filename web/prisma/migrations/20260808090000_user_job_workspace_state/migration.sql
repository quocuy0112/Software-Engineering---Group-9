-- Keep job-workspace preferences and hidden-job state account-scoped.

CREATE TABLE "UserJobWorkspaceState" (
    "userId" TEXT NOT NULL,
    "hiddenJobIds" JSONB NOT NULL,
    "jobPreferences" JSONB NOT NULL,
    "savedFilterPresets" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserJobWorkspaceState_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "UserJobWorkspaceState"
  ADD CONSTRAINT "UserJobWorkspaceState_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
