-- The recruiter job form has one skill list and labels it as required skills.
-- Older publication paths omitted the required flag, leaving those rows in
-- the preferred-only bucket used by automatic matching. Repair those rows and
-- make the database default match the current product contract.
UPDATE "JobPostingSkill"
SET "required" = true
WHERE "required" = false;

ALTER TABLE "JobPostingSkill"
  ALTER COLUMN "required" SET DEFAULT true;
