import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

import { cvConfiguration } from "@/backend/cv/config";
import { createArtifactCryptor } from "@/backend/cv/encryption/artifact-cryptor";
import { IntegrityVerifiedReader } from "@/backend/cv/encryption/integrity-verified-reader";
import { FilesystemPrivateCvStorage } from "@/backend/cv/storage/filesystem";
import type { PrivateCvStorage } from "@/backend/cv/storage/private-cv-storage";
import { S3PrivateCvStorage } from "@/backend/cv/storage/s3";
import { prisma } from "@/backend/database/prisma";

export type CvWorkerArtifactBytes = Readonly<{
  encryptionIv: Buffer;
  authenticationTag: Buffer;
  plaintextSha256: Buffer;
  sourceSha256: Buffer | null;
}>;

// PrismaPg serializes Date values as UTC fields for PostgreSQL timestamp(3)
// columns, so preserve the worker instant as the local wall-clock value.
export function cvWorkerDatabaseTimestamp(value: Date): Date {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
}

export async function readCvWorkerArtifactBytes(input: {
  artifactId: string;
  uploadId: string;
  accountId: string;
}): Promise<CvWorkerArtifactBytes> {
  const rows = await prisma.$queryRaw<
    Array<{
      encryptionIvHex: string;
      authenticationTagHex: string;
      plaintextSha256Hex: string;
      sourceSha256Hex: string | null;
    }>
  >`
    SELECT encode(artifact."encryptionIv", 'hex') AS "encryptionIvHex",
           encode(artifact."authenticationTag", 'hex') AS "authenticationTagHex",
           encode(artifact."plaintextSha256", 'hex') AS "plaintextSha256Hex",
           encode(upload."sourceSha256", 'hex') AS "sourceSha256Hex"
      FROM "CvStoredArtifact" artifact
      JOIN "CvUpload" upload
        ON upload."id" = artifact."uploadId"
       AND upload."accountId" = artifact."accountId"
     WHERE artifact."id" = ${input.artifactId}
       AND artifact."uploadId" = ${input.uploadId}
       AND artifact."accountId" = ${input.accountId}
       AND artifact."status" IN ('QUARANTINED', 'AVAILABLE')
       AND artifact."contentInaccessibleAt" IS NULL
       AND artifact."deletedAt" IS NULL
       AND upload."contentInaccessibleAt" IS NULL
       AND upload."deletedAt" IS NULL
     LIMIT 1
  `;
  const row = rows[0];
  if (!row) throw new Error("CV_ARTIFACT_NOT_AUTHORIZED");
  return Object.freeze({
    encryptionIv: Buffer.from(row.encryptionIvHex, "hex"),
    authenticationTag: Buffer.from(row.authenticationTagHex, "hex"),
    plaintextSha256: Buffer.from(row.plaintextSha256Hex, "hex"),
    sourceSha256: row.sourceSha256Hex
      ? Buffer.from(row.sourceSha256Hex, "hex")
      : null,
  });
}

export function createCvWorkerStorage(): PrivateCvStorage {
  if (cvConfiguration.storage.adapter === "filesystem") {
    if (!cvConfiguration.storage.localRoot)
      throw new Error("CV_STORAGE_CONFIGURATION_INVALID");
    return new FilesystemPrivateCvStorage({
      root: cvConfiguration.storage.localRoot,
    });
  }
  const s3 = cvConfiguration.storage.s3;
  if (!s3) throw new Error("CV_STORAGE_CONFIGURATION_INVALID");
  return new S3PrivateCvStorage({
    client: new S3Client({ region: s3.region }),
    bucket: s3.bucket,
    region: s3.region,
    kmsKeyId: s3.kmsKeyId,
  });
}

export function createCvWorkerCryptor() {
  return createArtifactCryptor({
    activeKeyVersion: cvConfiguration.encryption.activeKeyVersion,
    keys: Object.fromEntries(
      Object.entries(cvConfiguration.encryption.encodedKeys).map(
        ([version, encoded]) => [
          Number(version),
          Buffer.from(encoded, "base64"),
        ],
      ),
    ),
  });
}

export function createCvWorkerIntegrityReader(
  storage: PrivateCvStorage,
  cryptor: ReturnType<typeof createCvWorkerCryptor>,
) {
  return new IntegrityVerifiedReader({
    storage,
    cryptor,
    denyAndScheduleDeletion: async ({ artifactId }) => {
      const now = new Date();
      await prisma.cvStoredArtifact.updateMany({
        where: { id: artifactId, deletedAt: null },
        data: {
          status: "DELETE_PENDING",
          contentInaccessibleAt: now,
          deleteAfter: now,
          deleteFailureCode: "ARTIFACT_INTEGRITY_FAILED",
        },
      });
    },
  });
}
