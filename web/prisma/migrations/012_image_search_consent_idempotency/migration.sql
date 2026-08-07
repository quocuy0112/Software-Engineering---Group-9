ALTER TABLE "SearchProcessingConsent"
  ADD COLUMN "idempotencyDigest" BYTEA;

ALTER TABLE "SearchProcessingConsent"
  ADD CONSTRAINT "SearchProcessingConsent_idempotency_digest_length"
  CHECK ("idempotencyDigest" IS NULL OR octet_length("idempotencyDigest") = 32);

CREATE UNIQUE INDEX "SearchProcessingConsent_queryId_idempotencyDigest_key"
  ON "SearchProcessingConsent"("queryId", "idempotencyDigest");
