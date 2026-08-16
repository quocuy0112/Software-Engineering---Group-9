import "server-only";

import { prisma } from "@/backend/database/prisma";
import { CvImportServiceError } from "@/backend/services/cv-import/cv-http-errors";
import {
  CV_ACCOUNT_MAX_IMPORTS,
  CV_ACCOUNT_MAX_STORED_BYTES,
  CV_EXTRACTED_TEXT_MAX_BYTES,
  CV_SOURCE_MAX_BYTES,
  CV_UPLOAD_ATTEMPTS_PER_ROLLING_HOUR,
} from "@/shared/contracts/cv-import/common";

type ReserveInput = Readonly<{
  accountId: string;
  profileId: string;
  uploadId: string;
  documentKind: "PDF" | "DOCX";
  parserClass: "DETERMINISTIC_INTERNAL" | "EXTERNAL_OPENAI";
  declaredMediaType: string;
  declaredBytes: number;
  idempotencyDigest: Uint8Array;
  bindingDigest: Uint8Array;
  now: Date;
  expiresAt: Date;
  displayFilenameCiphertext?: string | null;
}>;

export type CvQuotaReservation = Readonly<{
  uploadId: string;
  replayed: boolean;
  reservedBytes: number;
  expiresAt: Date;
}>;

function bytesHex(value: Uint8Array): string {
  if (value.byteLength !== 32) throw new Error("CV_DIGEST_LENGTH_INVALID");
  return Buffer.from(value).toString("hex");
}

function validateReservation(input: ReserveInput): number {
  if (
    !input.accountId ||
    !input.profileId ||
    !input.uploadId ||
    !Number.isSafeInteger(input.declaredBytes) ||
    input.declaredBytes < 1 ||
    input.declaredBytes > CV_SOURCE_MAX_BYTES ||
    Number.isNaN(input.now.getTime()) ||
    input.expiresAt.getTime() !== input.now.getTime() + 30 * 86_400_000 ||
    (input.documentKind === "PDF" &&
      input.declaredMediaType !== "application/pdf") ||
    (input.documentKind === "DOCX" &&
      input.declaredMediaType !==
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  ) {
    throw new CvImportServiceError("VALIDATION_ERROR");
  }
  return input.declaredBytes + CV_EXTRACTED_TEXT_MAX_BYTES;
}

export class PrismaCvQuotaRepository {
  async reserve(input: ReserveInput): Promise<CvQuotaReservation> {
    const reservationBytes = validateReservation(input);
    const idempotencyHex = bytesHex(input.idempotencyDigest);
    const bindingHex = bytesHex(input.bindingDigest);
    return prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.$queryRaw<
          Array<{
            id: string;
            bindingHex: string;
            reservationBytes: number;
            expiresAt: Date;
          }>
        >`
          SELECT upload."id", encode(upload."createBindingDigest", 'hex') AS "bindingHex",
                 upload."quotaReservationBytes" AS "reservationBytes"
                 , upload."expiresAt" AS "expiresAt"
            FROM "CvUpload" upload
           WHERE upload."accountId" = ${input.accountId}
             AND upload."idempotencyDigest" = decode(${idempotencyHex}, 'hex')
           LIMIT 1
        `;
        if (existing[0]) {
          if (existing[0].bindingHex !== bindingHex) {
            throw new CvImportServiceError("IDEMPOTENCY_KEY_REUSED");
          }
          return Object.freeze({
            uploadId: existing[0].id,
            replayed: true,
            reservedBytes: existing[0].reservationBytes,
            expiresAt: existing[0].expiresAt,
          });
        }

        const owner = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT profile."id"
            FROM "CandidateProfile" profile
            JOIN "user" account ON account."id" = profile."candidateUserId"
           WHERE profile."id" = ${input.profileId}
             AND profile."candidateUserId" = ${input.accountId}
             AND account."state" = 'ACTIVE'
             AND account."deletedAt" IS NULL
           FOR UPDATE OF account, profile
        `;
        if (!owner[0]) throw new CvImportServiceError("FORBIDDEN");

        await transaction.$executeRaw`
          INSERT INTO "CvAccountQuota" (
            "accountId", "reservedBytes", "retainedBytes", "createdAt", "updatedAt"
          ) VALUES (${input.accountId}, 0, 0, ${input.now}, ${input.now})
          ON CONFLICT ("accountId") DO NOTHING
        `;
        const quotaRows = await transaction.$queryRaw<
          Array<{ reservedBytes: number; retainedBytes: number }>
        >`
          SELECT "reservedBytes", "retainedBytes"
            FROM "CvAccountQuota"
           WHERE "accountId" = ${input.accountId}
           FOR UPDATE
        `;
        const quota = quotaRows[0];
        if (!quota) throw new CvImportServiceError("CV_PROCESSING_UNAVAILABLE");

        const rolling = await transaction.$queryRaw<
          Array<{ count: bigint; oldest: Date | null }>
        >`
          SELECT COUNT(*)::bigint AS "count",
                 MIN("createdAt") AS "oldest"
            FROM "CvUpload"
           WHERE "accountId" = ${input.accountId}
             AND "createdAt" > ${new Date(input.now.getTime() - 60 * 60_000)}
        `;
        if (
          Number(rolling[0]?.count ?? 0) >= CV_UPLOAD_ATTEMPTS_PER_ROLLING_HOUR
        ) {
          const oldest = rolling[0]?.oldest;
          const retryAfterSeconds = oldest
            ? Math.max(
                1,
                Math.ceil(
                  (oldest.getTime() + 60 * 60_000 - input.now.getTime()) /
                    1_000,
                ),
              )
            : 60 * 60;
          throw new CvImportServiceError("UPLOAD_RATE_LIMITED", {
            retryAfterSeconds,
          });
        }
        const retained = await transaction.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS "count"
            FROM "CvUpload"
           WHERE "accountId" = ${input.accountId}
             AND "deletedAt" IS NULL
             AND "expiresAt" > ${input.now}
        `;
        if (Number(retained[0]?.count ?? 0) >= CV_ACCOUNT_MAX_IMPORTS) {
          throw new CvImportServiceError("CV_QUOTA_EXCEEDED");
        }
        if (
          quota.reservedBytes + quota.retainedBytes + reservationBytes >
          CV_ACCOUNT_MAX_STORED_BYTES
        ) {
          throw new CvImportServiceError("CV_QUOTA_EXCEEDED");
        }

        await transaction.$executeRaw`
          INSERT INTO "CvUpload" (
            "id", "accountId", "profileId", "documentKind", "parserClass", "status",
            "declaredMediaType", "declaredBytes", "quotaReservationBytes",
            "quotaReservationRemaining", "displayFilenameCiphertext",
            "idempotencyDigest", "createBindingDigest", "expiresAt", "createdAt", "updatedAt"
          ) VALUES (
            ${input.uploadId}, ${input.accountId}, ${input.profileId},
            ${input.documentKind}::"CvDocumentKind", ${input.parserClass}::"CvParserClass",
            'AWAITING_CONTENT', ${input.declaredMediaType}, ${input.declaredBytes},
            ${reservationBytes}, ${reservationBytes},
            ${input.displayFilenameCiphertext ?? null}, decode(${idempotencyHex}, 'hex'),
            decode(${bindingHex}, 'hex'), ${input.expiresAt}, ${input.now}, ${input.now}
          )
        `;
        await transaction.$executeRaw`
          UPDATE "CvAccountQuota"
             SET "reservedBytes" = "reservedBytes" + ${reservationBytes},
                 "updatedAt" = ${input.now}
           WHERE "accountId" = ${input.accountId}
        `;
        return Object.freeze({
          uploadId: input.uploadId,
          replayed: false,
          reservedBytes: reservationBytes,
          expiresAt: input.expiresAt,
        });
      },
      { isolationLevel: "Serializable" },
    );
  }

  async settleSource(
    uploadId: string,
    actualBytes: number,
    now: Date,
  ): Promise<boolean> {
    if (
      !Number.isSafeInteger(actualBytes) ||
      actualBytes < 1 ||
      actualBytes > CV_SOURCE_MAX_BYTES
    ) {
      throw new CvImportServiceError("VALIDATION_ERROR");
    }
    return prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        Array<{
          accountId: string;
          reservationBytes: number;
          remainingBytes: number;
        }>
      >`
        SELECT upload."accountId", upload."quotaReservationBytes" AS "reservationBytes",
               upload."quotaReservationRemaining" AS "remainingBytes"
          FROM "CvUpload" upload
         WHERE upload."id" = ${uploadId}
         FOR UPDATE
      `;
      const upload = rows[0];
      if (!upload) return false;
      await transaction.$queryRaw`
        SELECT "accountId" FROM "CvAccountQuota"
         WHERE "accountId" = ${upload.accountId} FOR UPDATE
      `;
      if (upload.remainingBytes !== upload.reservationBytes) return false;
      await transaction.$executeRaw`
        UPDATE "CvUpload"
           SET "quotaReservationRemaining" = "quotaReservationRemaining" - ${actualBytes},
               "updatedAt" = ${now}
         WHERE "id" = ${uploadId}
      `;
      await transaction.$executeRaw`
        UPDATE "CvAccountQuota"
           SET "reservedBytes" = "reservedBytes" - ${actualBytes},
               "retainedBytes" = "retainedBytes" + ${actualBytes},
               "updatedAt" = ${now}
         WHERE "accountId" = ${upload.accountId}
      `;
      return true;
    });
  }

  async settleExtraction(
    uploadId: string,
    extractedBytes: number,
    now = new Date(),
  ): Promise<boolean> {
    if (
      !Number.isSafeInteger(extractedBytes) ||
      extractedBytes < 0 ||
      extractedBytes > CV_EXTRACTED_TEXT_MAX_BYTES
    ) {
      throw new CvImportServiceError("VALIDATION_ERROR");
    }
    return prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        Array<{
          accountId: string;
          remainingBytes: number;
          reservationBytes: number;
        }>
      >`
        SELECT "accountId", "quotaReservationRemaining" AS "remainingBytes",
               "quotaReservationBytes" AS "reservationBytes"
          FROM "CvUpload" WHERE "id" = ${uploadId} FOR UPDATE
      `;
      const upload = rows[0];
      if (!upload || upload.remainingBytes > CV_EXTRACTED_TEXT_MAX_BYTES)
        return false;
      if (upload.remainingBytes < extractedBytes) {
        throw new CvImportServiceError("CV_QUOTA_EXCEEDED");
      }
      await transaction.$queryRaw`
        SELECT "accountId" FROM "CvAccountQuota"
         WHERE "accountId" = ${upload.accountId} FOR UPDATE
      `;
      await transaction.$executeRaw`
        UPDATE "CvUpload" SET "quotaReservationRemaining" = "quotaReservationRemaining" - ${extractedBytes},
          "updatedAt" = ${now} WHERE "id" = ${uploadId}
      `;
      await transaction.$executeRaw`
        UPDATE "CvAccountQuota" SET "reservedBytes" = "reservedBytes" - ${extractedBytes},
          "retainedBytes" = "retainedBytes" + ${extractedBytes}, "updatedAt" = ${now}
         WHERE "accountId" = ${upload.accountId}
      `;
      return true;
    });
  }

  async releaseRemaining(uploadId: string, now = new Date()): Promise<boolean> {
    return prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        Array<{ accountId: string; remainingBytes: number }>
      >`
        SELECT "accountId", "quotaReservationRemaining" AS "remainingBytes"
          FROM "CvUpload" WHERE "id" = ${uploadId} FOR UPDATE
      `;
      const upload = rows[0];
      if (!upload || upload.remainingBytes === 0) return false;
      await transaction.$queryRaw`
        SELECT "accountId" FROM "CvAccountQuota"
         WHERE "accountId" = ${upload.accountId} FOR UPDATE
      `;
      await transaction.$executeRaw`
        UPDATE "CvUpload" SET "quotaReservationRemaining" = 0, "updatedAt" = ${now}
         WHERE "id" = ${uploadId}
      `;
      await transaction.$executeRaw`
        UPDATE "CvAccountQuota" SET "reservedBytes" = "reservedBytes" - ${upload.remainingBytes},
          "updatedAt" = ${now} WHERE "accountId" = ${upload.accountId}
      `;
      return true;
    });
  }

  async releaseRetained(
    accountId: string,
    bytes: number,
    now = new Date(),
  ): Promise<boolean> {
    if (!Number.isSafeInteger(bytes) || bytes < 0) return false;
    const changed = await prisma.cvAccountQuota.updateMany({
      where: { accountId, retainedBytes: { gte: bytes } },
      data: { retainedBytes: { decrement: bytes }, updatedAt: now },
    });
    return changed.count === 1;
  }
}
