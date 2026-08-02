import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { once } from "node:events";
import { S3Client } from "@aws-sdk/client-s3";

import { cvConfiguration } from "@/backend/cv/config";
import { createArtifactCryptor } from "@/backend/cv/encryption/artifact-cryptor";
import { IntegrityVerifiedReader } from "@/backend/cv/encryption/integrity-verified-reader";
import { FilesystemPrivateCvStorage } from "@/backend/cv/storage/filesystem";
import type { PrivateCvStorage } from "@/backend/cv/storage/private-cv-storage";
import { S3PrivateCvStorage } from "@/backend/cv/storage/s3";
import { prisma } from "@/backend/database/prisma";
import type { Prisma } from "@/backend/generated/prisma/client";
import { PrismaCvQuotaRepository } from "@/backend/repositories/cv-import/prisma-cv-quota-repository";
import {
  assertCvStageResultCommitAllowed,
  type CvStageResultCommitGuard,
} from "@/backend/repositories/cv-import/prisma-cv-work-repository";
import { CV_EXTRACTED_TEXT_MAX_BYTES } from "@/shared/contracts/cv-import/common";
import type { ExtractedSegment } from "./document-extractor";

type SegmentCommitGuard = Readonly<
  Omit<CvStageResultCommitGuard, "now"> & { currentTime(): Date }
>;

function createStorage(): PrivateCvStorage {
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

function createCryptor() {
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

async function writeChunk(
  stream: ReturnType<typeof createWriteStream>,
  chunk: Buffer,
) {
  if (!stream.write(chunk)) await once(stream, "drain");
}

export class ExtractedSegmentStore {
  private readonly storage: PrivateCvStorage;
  private readonly cryptor: ReturnType<typeof createCryptor>;
  private readonly quota: PrismaCvQuotaRepository;

  constructor(dependencies?: {
    storage?: PrivateCvStorage;
    cryptor?: ReturnType<typeof createCryptor>;
    quota?: PrismaCvQuotaRepository;
  }) {
    this.storage = dependencies?.storage ?? createStorage();
    this.cryptor = dependencies?.cryptor ?? createCryptor();
    this.quota = dependencies?.quota ?? new PrismaCvQuotaRepository();
  }

  async writeEncrypted(input: {
    accountId: string;
    uploadId: string;
    extractionId: string;
    segments: AsyncIterable<ExtractedSegment> | Iterable<ExtractedSegment>;
    commitGuard?: SegmentCommitGuard;
  }) {
    const directory = await mkdtemp(join(tmpdir(), "smarthire-cv-segments-"));
    const pathname = join(directory, "segments.ndjson");
    const output = createWriteStream(pathname, { flags: "wx", mode: 0o600 });
    const ids = new Set<string>();
    const hash = createHash("sha256");
    let bytes = 0;
    let count = 0;
    try {
      for await (const segment of input.segments) {
        if (!/^[A-Za-z0-9_-]{1,100}$/u.test(segment.id) || ids.has(segment.id))
          throw new Error("CV_SEGMENT_ID_INVALID");
        ids.add(segment.id);
        const line = Buffer.from(`${JSON.stringify(segment)}\n`, "utf8");
        bytes += line.byteLength;
        if (bytes > CV_EXTRACTED_TEXT_MAX_BYTES)
          throw new Error("CV_SEGMENT_LIMIT_EXCEEDED");
        count += 1;
        hash.update(line);
        await writeChunk(output, line);
      }
      output.end();
      await once(output, "close");
      if (!count) throw new Error("CV_SEGMENTS_EMPTY");
      await this.storage.assertReady();
      const artifactId = randomUUID();
      const ciphertext = new PassThrough();
      const storedPromise = this.storage.put({
        source: ciphertext,
        expectedBytes: bytes,
      });
      const envelope = await this.cryptor.encrypt({
        plaintext: createReadStream(pathname),
        ciphertext,
        context: {
          accountId: input.accountId,
          uploadId: input.uploadId,
          artifactId,
          kind: "EXTRACTED_TEXT",
        },
      });
      ciphertext.end();
      const stored = await storedPromise;
      try {
        const persistArtifact = async (
          transaction: Prisma.TransactionClient,
          availableAt: Date,
        ) => {
          await transaction.cvStoredArtifact.create({
            data: {
              id: artifactId,
              uploadId: input.uploadId,
              accountId: input.accountId,
              kind: "EXTRACTED_TEXT",
              status: "AVAILABLE",
              storageAdapter: cvConfiguration.storage.adapter,
              storageLocator: stored.locator,
              encryptionKeyVersion: envelope.keyVersion,
              encryptionIv: Uint8Array.from(envelope.iv),
              authenticationTag: Uint8Array.from(envelope.authenticationTag),
              plaintextBytes: bytes,
              ciphertextBytes: stored.bytes,
              plaintextSha256: Uint8Array.from(hash.digest()),
              availableAt,
            },
          });
          const changed = await transaction.cvExtraction.updateMany({
            where: {
              id: input.extractionId,
              uploadId: input.uploadId,
              accountId: input.accountId,
              outputArtifactId: null,
            },
            data: {
              outputArtifactId: artifactId,
              segmentCount: count,
              extractedUtf8Bytes: bytes,
            },
          });
          if (changed.count !== 1)
            throw new Error(
              input.commitGuard
                ? "CV_STAGE_RESULT_DISCARDED"
                : "CV_EXTRACTION_FINALIZE_CONFLICT",
            );
        };

        if (input.commitGuard) {
          await prisma.$transaction(async (transaction) => {
            const current = input.commitGuard!.currentTime();
            if (Number.isNaN(current.getTime())) {
              throw new Error("CV_WORKER_CLOCK_INVALID");
            }
            await assertCvStageResultCommitAllowed(transaction, {
              ...input.commitGuard!,
              now: current,
            });
            const uploads = await transaction.$queryRaw<
              Array<{ accountId: string; remainingBytes: number }>
            >`
              SELECT upload."accountId",
                     upload."quotaReservationRemaining" AS "remainingBytes"
                FROM "CvUpload" upload
               WHERE upload."id" = ${input.uploadId}
                 AND upload."accountId" = ${input.accountId}
               FOR UPDATE
            `;
            const upload = uploads[0];
            if (
              !upload ||
              upload.remainingBytes > CV_EXTRACTED_TEXT_MAX_BYTES ||
              upload.remainingBytes < bytes
            ) {
              throw new Error("CV_EXTRACTION_QUOTA_SETTLEMENT_CONFLICT");
            }
            const quota = await transaction.$queryRaw<
              Array<{ accountId: string }>
            >`
              SELECT "accountId" FROM "CvAccountQuota"
               WHERE "accountId" = ${input.accountId}
               FOR UPDATE
            `;
            if (!quota[0]) {
              throw new Error("CV_EXTRACTION_QUOTA_SETTLEMENT_CONFLICT");
            }
            await transaction.$executeRaw`
              UPDATE "CvUpload"
                 SET "quotaReservationRemaining" = "quotaReservationRemaining" - ${bytes},
                     "updatedAt" = ${current}
               WHERE "id" = ${input.uploadId}
                 AND "accountId" = ${input.accountId}
            `;
            await transaction.$executeRaw`
              UPDATE "CvAccountQuota"
                 SET "reservedBytes" = "reservedBytes" - ${bytes},
                     "retainedBytes" = "retainedBytes" + ${bytes},
                     "updatedAt" = ${current}
               WHERE "accountId" = ${input.accountId}
            `;
            await persistArtifact(transaction, current);
          });
        } else {
          const settled = await this.quota.settleExtraction(
            input.uploadId,
            bytes,
          );
          if (!settled) {
            throw new Error("CV_EXTRACTION_QUOTA_SETTLEMENT_CONFLICT");
          }
          await prisma.$transaction((transaction) =>
            persistArtifact(transaction, new Date()),
          );
        }
      } catch (error) {
        await this.storage.delete(stored.locator).catch(() => undefined);
        throw error;
      }
      return Object.freeze({
        artifactId,
        segmentIds: new Set(ids) as ReadonlySet<string>,
        segmentCount: count,
        utf8Bytes: bytes,
      });
    } finally {
      output.destroy();
      await rm(directory, { recursive: true, force: true });
    }
  }

  async openAuthorized(input: {
    accountId: string;
    uploadId: string;
    artifactId: string;
    parseJobId: string;
  }): Promise<readonly ExtractedSegment[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        storageLocator: string;
        ciphertextBytes: number;
        plaintextBytes: number;
        plaintextSha256Hex: string;
        encryptionKeyVersion: number;
        encryptionIvHex: string;
        authenticationTagHex: string;
      }>
    >`
      SELECT artifact."id",
             artifact."storageLocator",
             artifact."ciphertextBytes",
             artifact."plaintextBytes",
             encode(artifact."plaintextSha256", 'hex') AS "plaintextSha256Hex",
             artifact."encryptionKeyVersion",
             encode(artifact."encryptionIv", 'hex') AS "encryptionIvHex",
             encode(artifact."authenticationTag", 'hex') AS "authenticationTagHex"
        FROM "CvStoredArtifact" artifact
        JOIN "CvExtraction" extraction
          ON extraction."outputArtifactId" = artifact."id"
        JOIN "CvParseJob" parse_job
          ON parse_job."extractionId" = extraction."id"
       WHERE artifact."id" = ${input.artifactId}
         AND artifact."uploadId" = ${input.uploadId}
         AND artifact."accountId" = ${input.accountId}
         AND artifact."kind"::text = 'EXTRACTED_TEXT'
         AND artifact."status"::text = 'AVAILABLE'
         AND artifact."contentInaccessibleAt" IS NULL
         AND extraction."uploadId" = ${input.uploadId}
         AND extraction."accountId" = ${input.accountId}
         AND parse_job."id" = ${input.parseJobId}
         AND parse_job."uploadId" = ${input.uploadId}
         AND parse_job."accountId" = ${input.accountId}
         AND parse_job."status"::text IN ('QUEUED', 'PROCESSING')
       LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error("CV_EXTRACTED_ARTIFACT_NOT_AUTHORIZED");
    await this.storage.assertReady();
    const reader = new IntegrityVerifiedReader({
      storage: this.storage,
      cryptor: this.cryptor,
      denyAndScheduleDeletion: async ({ artifactId }) => {
        await prisma.cvStoredArtifact.updateMany({
          where: { id: artifactId },
          data: {
            status: "DELETE_PENDING",
            contentInaccessibleAt: new Date(),
            deleteAfter: new Date(),
            deleteFailureCode: "ARTIFACT_INTEGRITY_FAILED",
          },
        });
      },
    });
    const verified = await reader.verify({
      locator: row.storageLocator,
      ciphertextBytes: row.ciphertextBytes,
      plaintextBytes: row.plaintextBytes,
      plaintextSha256: Buffer.from(row.plaintextSha256Hex, "hex"),
      context: {
        accountId: input.accountId,
        uploadId: input.uploadId,
        artifactId: row.id,
        kind: "EXTRACTED_TEXT",
      },
      envelope: {
        keyVersion: row.encryptionKeyVersion,
        iv: Buffer.from(row.encryptionIvHex, "hex"),
        authenticationTag: Buffer.from(row.authenticationTagHex, "hex"),
      },
    });
    try {
      let text = "";
      for await (const chunk of verified.open())
        text += Buffer.from(chunk).toString("utf8");
      const ids = new Set<string>();
      return Object.freeze(
        text
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const value = JSON.parse(line) as ExtractedSegment;
            if (ids.has(value.id))
              throw new Error("CV_SEGMENT_MEMBERSHIP_INVALID");
            ids.add(value.id);
            return Object.freeze(value);
          }),
      );
    } finally {
      await verified.dispose();
    }
  }
}
