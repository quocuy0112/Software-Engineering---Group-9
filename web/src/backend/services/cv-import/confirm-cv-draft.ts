import "server-only";

import { createHmac } from "node:crypto";

import { serverEnvironment } from "@/backend/env/runtime";
import { PrismaCvConfirmationRepository } from "@/backend/repositories/cv-import/prisma-cv-confirmation-repository";
import { ensureCandidateCvLibrary } from "@/backend/services/profile/candidate-cv-library";
import { prisma } from "@/backend/database/prisma";
import {
  createCvWorkerCryptor,
  createCvWorkerIntegrityReader,
  createCvWorkerStorage,
} from "@/backend/cv/workers/cv-worker-resources";
import {
  confirmCvDraftRequestSchema,
  type ConfirmCvDraftRequest,
} from "@/shared/contracts/cv-import/review";

function logCandidateCvProjectionFailure(
  error: unknown,
  input: { accountId: string; draftId: string },
) {
  const details =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message.slice(0, 1_000),
          stack: error.stack?.slice(0, 4_000),
        }
      : { type: typeof error, message: String(error).slice(0, 1_000) };
  console.error(
    JSON.stringify({
      event: "cv_candidate_cv_projection_failed",
      operation: "cv-draft.confirm",
      ...input,
      error: details,
    }),
  );
}

async function materializeConfirmedCandidateCv(
  accountId: string,
  uploadId: string,
) {
  const candidateCvId = `candidate-cv-${uploadId}`;
  const cv = await prisma.candidateCv.findUnique({
    where: { id: candidateCvId },
  });
  if (!cv || cv.storageKey !== candidateCvId) return;
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      storageLocator: string;
      encryptionKeyVersion: number;
      encryptionIvHex: string;
      authenticationTagHex: string;
      plaintextBytes: number;
      ciphertextBytes: number;
      plaintextSha256Hex: string;
    }>
  >`
    SELECT artifact."id", artifact."storageLocator", artifact."encryptionKeyVersion",
           encode(artifact."encryptionIv", 'hex') AS "encryptionIvHex",
           encode(artifact."authenticationTag", 'hex') AS "authenticationTagHex",
           artifact."plaintextBytes", artifact."ciphertextBytes",
           encode(artifact."plaintextSha256", 'hex') AS "plaintextSha256Hex"
      FROM "CvStoredArtifact" artifact
     WHERE artifact."uploadId" = ${uploadId}
       AND artifact."accountId" = ${accountId}
       AND artifact."kind" = 'SOURCE_DOCUMENT'
       AND artifact."deletedAt" IS NULL
     ORDER BY artifact."createdAt" DESC LIMIT 1
  `;
  const artifact = rows[0];
  if (!artifact) throw new Error("CANDIDATE_CV_SOURCE_UNAVAILABLE");
  const storage = createCvWorkerStorage();
  await storage.assertReady();
  const verified = await createCvWorkerIntegrityReader(
    storage,
    createCvWorkerCryptor(),
  ).verify({
    locator: artifact.storageLocator,
    ciphertextBytes: artifact.ciphertextBytes,
    plaintextBytes: artifact.plaintextBytes,
    plaintextSha256: Buffer.from(artifact.plaintextSha256Hex, "hex"),
    context: {
      accountId,
      uploadId,
      artifactId: artifact.id,
      kind: "SOURCE_DOCUMENT",
    },
    envelope: {
      keyVersion: artifact.encryptionKeyVersion,
      iv: Buffer.from(artifact.encryptionIvHex, "hex"),
      authenticationTag: Buffer.from(artifact.authenticationTagHex, "hex"),
    },
  });
  try {
    const stored = await storage.put({
      source: verified.open(),
      expectedBytes: verified.plaintextBytes,
    });
    await prisma.candidateCv.update({
      where: { id: candidateCvId, storageKey: candidateCvId },
      data: { storageKey: String(stored.locator) },
    });
  } finally {
    await verified.dispose();
  }
}

export class ConfirmCvDraftService {
  constructor(
    private readonly repository = new PrismaCvConfirmationRepository(),
    private readonly secret = serverEnvironment.TOKEN_SECRET,
  ) {}

  async execute(input: {
    accountId: string;
    draftId: string;
    idempotencyKey: string;
    request: ConfirmCvDraftRequest;
  }) {
    const request = confirmCvDraftRequestSchema.parse(input.request);
    const digest = createHmac("sha256", this.secret)
      .update("smarthire:cv-confirm:idempotency:v1\0", "utf8")
      .update(input.idempotencyKey, "utf8")
      .digest();
    const result = await this.repository.confirm({
      accountId: input.accountId,
      draftId: input.draftId,
      idempotencyDigest: digest,
      draftRevision: request.draftRevision,
      sourceProfileRevision: request.sourceProfileRevision,
      reviewedProfileRevision: request.reviewedProfileRevision,
      now: new Date(),
    });
    // CandidateCv is a read projection used by Apply. Keep it outside the
    // profile confirmation transaction so a projection/legacy-data problem
    // cannot roll back an otherwise valid CV confirmation.
    try {
      await ensureCandidateCvLibrary(input.accountId);
      await materializeConfirmedCandidateCv(
        input.accountId,
        result.receipt.uploadId,
      );
    } catch (error) {
      logCandidateCvProjectionFailure(error, {
        accountId: input.accountId,
        draftId: input.draftId,
      });
    }
    return result;
  }
}
