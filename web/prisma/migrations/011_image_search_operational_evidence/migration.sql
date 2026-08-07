CREATE TABLE "ImageSearchOperationalEvidence" (
    "component" TEXT NOT NULL,
    "evidenceVersion" TEXT NOT NULL,
    "evidenceDigest" BYTEA,
    "succeededAt" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageSearchOperationalEvidence_pkey" PRIMARY KEY ("component"),
    CONSTRAINT "ImageSearchOperationalEvidence_component" CHECK (
      "component" IN ('CLEANUP', 'RECONCILIATION', 'STORAGE_PREFLIGHT')
    ),
    CONSTRAINT "ImageSearchOperationalEvidence_window" CHECK (
      "validUntil" > "succeededAt"
    )
);

CREATE INDEX "ImageSearchOperationalEvidence_validUntil_idx"
  ON "ImageSearchOperationalEvidence"("validUntil");

REVOKE UPDATE ("component") ON "ImageSearchOperationalEvidence" FROM PUBLIC;
