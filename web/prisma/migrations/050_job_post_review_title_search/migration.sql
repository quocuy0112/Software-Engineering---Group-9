-- Persist a normalized title projection so administrator review search does not
-- depend on case-sensitive JSON filtering.
ALTER TABLE "JobPostReviewVersion"
ADD COLUMN "normalizedTitleSearch" TEXT NOT NULL DEFAULT '';

-- Provides an immediate safe baseline for existing rows. The application
-- backfill normalizes Vietnamese diacritics with the shared TypeScript helper.
UPDATE "JobPostReviewVersion"
SET "normalizedTitleSearch" = lower(COALESCE("snapshot" ->> 'title', ''))
WHERE "normalizedTitleSearch" = '';

CREATE INDEX "JobPostReviewVersion_normalizedTitleSearch_idx"
ON "JobPostReviewVersion"("normalizedTitleSearch");
