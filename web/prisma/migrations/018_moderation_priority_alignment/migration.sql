-- Align persisted moderation priority names with the approved specification.
ALTER TYPE "ModerationPriority" RENAME TO "ModerationPriority_old";
CREATE TYPE "ModerationPriority" AS ENUM ('NORMAL', 'HIGH', 'CRITICAL');
ALTER TABLE "ModerationReport"
  ALTER COLUMN "priority" DROP DEFAULT,
  ALTER COLUMN "priority" TYPE "ModerationPriority"
    USING (CASE
      WHEN "priority"::text = 'URGENT' THEN 'CRITICAL'
      WHEN "priority"::text = 'LOW' THEN 'NORMAL'
      ELSE "priority"::text
    END)::"ModerationPriority",
  ALTER COLUMN "priority" SET DEFAULT 'NORMAL';
DROP TYPE "ModerationPriority_old";
