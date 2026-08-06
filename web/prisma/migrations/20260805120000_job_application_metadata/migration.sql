-- Additive migration for the inline application experience.
-- Existing application snapshots remain immutable; these fields capture the
-- contact/file/AI choices made at submission time.
ALTER TABLE "JobApplication"
  ADD COLUMN "cvFileRef" TEXT,
  ADD COLUMN "contactSnapshot" JSONB,
  ADD COLUMN "aiAnalysisConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "aiMatchScore" INTEGER;

ALTER TABLE "JobApplication"
  ADD CONSTRAINT "JobApplication_inline_metadata_check" CHECK (
    ("cvFileRef" IS NULL OR char_length("cvFileRef") BETWEEN 1 AND 256) AND
    ("contactSnapshot" IS NULL OR (
      jsonb_typeof("contactSnapshot") = 'object' AND
      octet_length("contactSnapshot"::text) <= 8192
    )) AND
    ("aiAnalysisConsent" = true OR "aiMatchScore" IS NULL) AND
    ("aiMatchScore" IS NULL OR "aiMatchScore" BETWEEN 0 AND 100)
  );

CREATE INDEX "JobApplication_candidateUserId_aiAnalysisConsent_idx"
  ON "JobApplication"("candidateUserId", "aiAnalysisConsent");
