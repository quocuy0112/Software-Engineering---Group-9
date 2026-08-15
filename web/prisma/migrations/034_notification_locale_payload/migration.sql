ALTER TABLE "InAppNotification"
  ADD COLUMN IF NOT EXISTS "variables" JSONB;
