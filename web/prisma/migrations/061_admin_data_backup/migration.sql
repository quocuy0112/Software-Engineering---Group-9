CREATE TYPE "BackupRunTrigger" AS ENUM ('MANUAL', 'SCHEDULED');
CREATE TYPE "BackupRunStatus" AS ENUM ('QUEUED', 'LEASED', 'SUCCEEDED', 'FAILED');

CREATE TABLE "BackupConfiguration" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "intervalSeconds" INTEGER NOT NULL DEFAULT 60,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedByAdminId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BackupConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackupRun" (
  "id" TEXT NOT NULL,
  "trigger" "BackupRunTrigger" NOT NULL,
  "status" "BackupRunStatus" NOT NULL DEFAULT 'QUEUED',
  "activeKey" TEXT,
  "requestedById" TEXT,
  "idempotencyKey" TEXT,
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "driveFileId" TEXT,
  "fileName" TEXT,
  "checksum" TEXT,
  "byteCount" INTEGER,
  "failureCode" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BackupRun_activeKey_key" ON "BackupRun"("activeKey");
CREATE UNIQUE INDEX "BackupRun_requestedById_idempotencyKey_key" ON "BackupRun"("requestedById", "idempotencyKey");
CREATE INDEX "BackupRun_status_leaseExpiresAt_requestedAt_idx" ON "BackupRun"("status", "leaseExpiresAt", "requestedAt");
