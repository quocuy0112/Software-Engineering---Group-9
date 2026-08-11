-- One lifecycle notification row per verification request and event kind.
CREATE UNIQUE INDEX "EmailOutbox_verification_event_unique"
  ON "EmailOutbox"("verificationRequestId", "idempotencyKey")
  WHERE "verificationRequestId" IS NOT NULL;
