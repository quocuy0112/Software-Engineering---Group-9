import "server-only";

import { randomUUID } from "node:crypto";

import { OCR_EXPECTED_ENGINE_VERSION } from "@/backend/image-search/config";

import { prisma } from "@/backend/database/prisma";
import {
  readSearchArtifact,
  oneChunk,
} from "@/backend/image-search/storage/artifact-io";
import { readSearchArtifactEnvelope } from "@/backend/image-search/storage/prisma-artifact-envelope";
import type { SearchStorageResource } from "@/backend/image-search/storage/factory";
import type { ImageNormalizer } from "@/backend/ocr/image-normalizer";
import {
  PrismaImageSearchWorkRepository,
  type ImageSearchWorkClaim,
} from "@/backend/repositories/image-search/prisma-image-search-work-repository";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";

function decodeFailure(error: unknown) {
  const code = (error as Error).message;
  if (code === "IMAGE_PIXEL_LIMIT_EXCEEDED") return "IMAGE_LIMIT_EXCEEDED";
  if (["IMAGE_FORMAT_UNSUPPORTED", "IMAGE_FORMAT_MISMATCH"].includes(code))
    return "UNSUPPORTED_IMAGE";
  return "IMAGE_DECODE_FAILED";
}

export class ImageSearchDecodeStage {
  constructor(
    private readonly dependencies: Readonly<{
      normalizer: ImageNormalizer;
      storage: SearchStorageResource;
      work: PrismaImageSearchWorkRepository;
      queries: PrismaImageSearchQueryRepository;
    }>,
  ) {}

  async process(claim: ImageSearchWorkClaim, now: Date, signal: AbortSignal) {
    const row = await prisma.searchImageDecodeAttempt.findUnique({
      where: { id: claim.id },
      select: {
        id: true,
        queryId: true,
        sourceArtifactId: true,
        scanAssessmentId: true,
        query: {
          select: {
            declaredExtension: true,
            declaredMediaType: true,
            deleteBy: true,
          },
        },
        scanAssessment: { select: { status: true, sourceArtifactId: true } },
        sourceArtifact: {
          select: {
            kind: true,
            status: true,
            storageLocator: true,
            plaintextBytes: true,
          },
        },
      },
    });
    if (
      !row ||
      row.queryId !== claim.queryId ||
      row.scanAssessment.status !== "CLEAN" ||
      row.scanAssessment.sourceArtifactId !== row.sourceArtifactId ||
      row.sourceArtifact.kind !== "SOURCE_IMAGE" ||
      row.sourceArtifact.status !== "AVAILABLE"
    )
      throw new Error("STAGE_RESULT_DISCARDED");
    const envelope = await readSearchArtifactEnvelope(row.sourceArtifactId);
    if (!envelope) throw new Error("STAGE_RESULT_DISCARDED");
    let unattachedLocator:
      | Parameters<typeof this.dependencies.storage.storage.delete>[0]
      | null = null;
    try {
      const source = await readSearchArtifact({
        storage: this.dependencies.storage.storage,
        locator: row.sourceArtifact.storageLocator,
        authenticationTag: envelope.authenticationTag,
        context: {
          queryId: row.queryId,
          artifactId: row.sourceArtifactId,
          kind: "SOURCE_IMAGE",
        },
        expectedBytes: row.sourceArtifact.plaintextBytes,
        expectedSha256: envelope.plaintextSha256,
        maximumBytes: 5_000_000,
      });
      const normalized = await this.dependencies.normalizer.normalize({
        purpose: "JOB_IMAGE_SEARCH",
        cleanAssessmentId: row.scanAssessmentId,
        source: oneChunk(source),
        declaredFormat:
          row.query.declaredMediaType === "image/png" ? "png" : "jpeg",
        maximumSourceBytes: 5_000_000,
        maximumDecodedPixels: 20_000_000,
        maximumOutputBytes: 25 * 1024 * 1024,
        signal,
      });
      await this.dependencies.work.assertCommitAllowed({ claim, now });
      const artifactId = randomUUID();
      const stored = await this.dependencies.storage.storage.put({
        source: oneChunk(normalized.bytes),
        expectedBytes: normalized.bytes.byteLength,
        context: {
          queryId: row.queryId,
          artifactId,
          kind: "NORMALIZED_IMAGE",
        },
      });
      unattachedLocator = stored.locator;
      await prisma.$transaction(async (transaction) => {
        await transaction.searchStoredArtifact.create({
          data: {
            id: artifactId,
            queryId: row.queryId,
            kind: "NORMALIZED_IMAGE",
            status: "AVAILABLE",
            storageAdapter: this.dependencies.storage.adapterName,
            storageLocator: String(stored.locator),
            encryptionKeyVersion: stored.encryptionKeyVersion,
            encryptionIv: Buffer.from(stored.encryptionIv),
            authenticationTag: Buffer.from(stored.authenticationTag),
            plaintextBytes: stored.plaintextBytes,
            ciphertextBytes: stored.ciphertextBytes,
            plaintextSha256: Buffer.from(stored.plaintextSha256),
            availableAt: now,
            deleteBy: row.query.deleteBy,
          },
          select: { id: true },
        });
        const committed = await transaction.searchImageDecodeAttempt.updateMany(
          {
            where: {
              id: claim.id,
              queryId: row.queryId,
              status: "PROCESSING",
              leaseOwner: claim.leaseOwner,
              leaseExpiresAt: { gt: now },
              query: {
                status: "DECODING",
                contentInaccessibleAt: null,
                deleteBy: { gt: now },
              },
            },
            data: {
              status: "SUCCEEDED",
              normalizedArtifactId: artifactId,
              normalizerName: normalized.normalizer,
              normalizerVersion: normalized.normalizerVersion,
              rulesVersion: normalized.rulesVersion,
              detectedFormat: normalized.sourceFormat,
              width: normalized.width,
              height: normalized.height,
              decodedPixels: normalized.normalizedPixels,
              frameCount: normalized.frameCount,
              metadataRemoved: normalized.metadataRemoved,
              completedAt: now,
              leaseOwner: null,
              leaseExpiresAt: null,
            },
          },
        );
        if (committed.count !== 1) throw new Error("STAGE_RESULT_DISCARDED");
        await transaction.searchStoredArtifact.update({
          where: { id: row.sourceArtifactId },
          data: {
            status: "DELETE_PENDING",
            contentInaccessibleAt: now,
            deleteAfter: now,
          },
          select: { id: true },
        });
        await transaction.ocrProcessingAttempt.create({
          data: {
            id: randomUUID(),
            purpose: "JOB_IMAGE_SEARCH",
            searchQueryId: row.queryId,
            status: "QUEUED",
            engineName: "paddleocr-onnx",
            engineVersion: OCR_EXPECTED_ENGINE_VERSION,
            modelName: "PP-OCRv6-medium",
            modelSha256: Buffer.from(process.env.OCR_MODEL_SHA256 ?? "", "hex"),
            runtimeName: "onnxruntime",
            runtimeVersion: "1.27.0",
            confidencePolicyVersion: "ocr-confidence-v1",
            inputUnitCount: 1,
          },
          select: { id: true },
        });
        await transaction.searchImageQuery.update({
          where: { id: row.queryId },
          data: { status: "OCR_QUEUED" },
          select: { id: true },
        });
      });
      unattachedLocator = null;
    } catch (error) {
      if (unattachedLocator)
        await this.dependencies.storage.storage
          .delete(unattachedLocator)
          .catch(() => undefined);
      if ((error as Error).message === "STAGE_RESULT_DISCARDED") throw error;
      const failureCode = decodeFailure(error);
      await prisma.searchImageDecodeAttempt.updateMany({
        where: { id: claim.id, leaseOwner: claim.leaseOwner },
        data: {
          status: "FAILED",
          failureCode,
          completedAt: now,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      await this.dependencies.queries.makeContentInaccessible({
        queryId: row.queryId,
        now,
        status: "DECODE_FAILED",
        failureCode,
      });
    }
  }
}
