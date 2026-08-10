-- Durable claim fields prevent concurrent workers from scanning the same evidence.
ALTER TABLE "BusinessLicenseEvidence"
  ADD COLUMN "processingLeaseOwner" TEXT,
  ADD COLUMN "processingLeaseExpiry" TIMESTAMP(3);

CREATE INDEX "BusinessLicenseEvidence_processingLeaseExpiry_idx"
  ON "BusinessLicenseEvidence"("processingLeaseExpiry");
