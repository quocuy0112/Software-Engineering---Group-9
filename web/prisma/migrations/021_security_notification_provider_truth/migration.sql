-- Additive provider-truth linkage for Feature 006 security notifications.
-- Existing idempotency keys and delivery rows are intentionally not rewritten.
ALTER TABLE "SecurityNotificationWork"
  ADD COLUMN "emailOutboxId" TEXT,
  ADD COLUMN "opsAlertedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "SecurityNotificationWork_emailOutboxId_key"
  ON "SecurityNotificationWork"("emailOutboxId");

ALTER TABLE "SecurityNotificationWork"
  ADD CONSTRAINT "SecurityNotificationWork_emailOutboxId_fkey"
  FOREIGN KEY ("emailOutboxId") REFERENCES "EmailOutbox"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
