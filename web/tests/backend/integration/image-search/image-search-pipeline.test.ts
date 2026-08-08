import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/backend/database/prisma";
import { DeterministicSearchIntentInterpreter } from "@/backend/image-search/interpretation/deterministic";
import { SearchIntentSelectionPolicy } from "@/backend/image-search/interpretation/selection-policy";
import { oneChunk } from "@/backend/image-search/storage/artifact-io";
import { FilesystemPrivateSearchArtifactStorage } from "@/backend/image-search/storage/filesystem";
import { ImageSearchDecodeStage } from "@/backend/image-search/workers/decode-stage";
import { ImageSearchInterpretStage } from "@/backend/image-search/workers/interpret-stage";
import { ImageSearchOcrStage } from "@/backend/image-search/workers/ocr-stage";
import { ImageSearchScanStage } from "@/backend/image-search/workers/scan-stage";
import type { ImageNormalizer } from "@/backend/ocr/image-normalizer";
import type { OcrEngine } from "@/backend/ocr/ocr-engine";
import { PrismaImageSearchAdmissionRepository } from "@/backend/repositories/image-search/prisma-image-search-admission-repository";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";
import { PrismaImageSearchWorkRepository } from "@/backend/repositories/image-search/prisma-image-search-work-repository";
import { CreateImageSearchFallbackService } from "@/backend/services/image-search/create-image-search-fallback";
import { ValidateSearchIntentService } from "@/backend/services/image-search/validate-search-intent";

const queryIds: string[] = [];
const roots: string[] = [];

afterEach(async () => {
  if (queryIds.length)
    await prisma.searchImageQuery.deleteMany({
      where: { id: { in: queryIds.splice(0) } },
    });
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe.sequential("image-search worker pipeline", () => {
  it("commits clean scan, decode, OCR, and deterministic intent under stage leases", async () => {
    const base = new Date();
    const source = Buffer.from("89504e470d0a1a0a", "hex");
    const admitted = await new PrismaImageSearchAdmissionRepository().admit({
      actor: {
        kind: "VISITOR",
        browserDigest: Buffer.alloc(32, 11),
        sourceIpDigest: Buffer.alloc(32, 12),
        capability: Buffer.alloc(32, 13).toString("base64url"),
        capabilityHmacKey: Buffer.alloc(32, 14),
        capabilityKeyVersion: 1,
      },
      metadata: {
        extension: "png",
        mediaType: "image/png",
        bytes: source.byteLength,
        interpreterClass: "DETERMINISTIC_INTERNAL",
        consent: null,
      },
      idempotencyDigest: Buffer.alloc(32, 15),
      bindingDigest: Buffer.alloc(32, 16),
      now: base,
    });
    if (admitted.kind !== "ADMITTED")
      throw new Error("fixture admission failed");
    queryIds.push(admitted.query.id);

    const root = await mkdtemp(join(tmpdir(), "image-search-pipeline-"));
    roots.push(root);
    const storage = new FilesystemPrivateSearchArtifactStorage({
      root,
      keyring: {
        activeKeyVersion: 1,
        keys: new Map([[1, Buffer.alloc(32, 17)]]),
      },
    });
    const storageResource = { adapterName: "filesystem", storage } as const;
    const artifactId = randomUUID();
    const stored = await storage.put({
      source: oneChunk(source),
      expectedBytes: source.byteLength,
      context: {
        queryId: admitted.query.id,
        artifactId,
        kind: "SOURCE_IMAGE",
      },
    });
    const queries = new PrismaImageSearchQueryRepository();
    await queries.attachSourceAndQueueScan({
      queryId: admitted.query.id,
      now: base,
      artifactId,
      adapter: "filesystem",
      stored,
    });

    const work = new PrismaImageSearchWorkRepository();
    const owner = `test-worker:${randomUUID()}`;
    const scanner = {
      async scan() {
        return { outcome: "CLEAN" as const, engineVersion: "fixture-clamav" };
      },
    };
    const normalizer: ImageNormalizer = {
      async normalize() {
        return {
          format: "png",
          bytes: Buffer.from("normalized fixture"),
          sourceFormat: "png",
          width: 100,
          height: 50,
          sourceDecodedPixels: 5_000,
          normalizedPixels: 5_000,
          frameCount: 1,
          metadataRemoved: true,
          autoOriented: false,
          downscaled: false,
          normalizer: "sharp",
          normalizerVersion: "0.35.3",
          rulesVersion: "search-image-normalize-v1",
        };
      },
    };
    const recognizedText = "Position: Senior TypeScript Engineer\nRemote";
    const ocr: OcrEngine = {
      async assertReady() {},
      async recognize(input) {
        return {
          schemaVersion: "ocr-lines-v1",
          attemptId: input.attemptId,
          purpose: "JOB_IMAGE_SEARCH",
          engine: {
            name: "paddleocr-onnx",
            version: "1.0.0",
            runtimeName: "onnxruntime",
            runtimeVersion: "1.27.0",
            modelName: "PP-OCRv6-medium",
            modelManifestSha256: "a".repeat(64),
          },
          image: {
            width: input.image.width,
            height: input.image.height,
            decodedPixels: input.image.decodedPixels,
            detectedOrientationDegrees: 0,
          },
          lines: [
            {
              id: "line-0",
              order: 0,
              text: recognizedText,
              confidence: 0.99,
              polygon: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 20 },
                { x: 0, y: 20 },
              ],
            },
          ],
          summary: {
            lineCount: 1,
            utf8Bytes: Buffer.byteLength(recognizedText, "utf8"),
            averageConfidence: 0.99,
            minimumConfidence: 0.99,
            partial: false,
          },
        };
      },
    };
    const policy = new SearchIntentSelectionPolicy();
    const deterministic = new ValidateSearchIntentService({
      interpreter: new DeterministicSearchIntentInterpreter(),
      selectionPolicy: policy,
    });
    const stages = {
      SCAN: new ImageSearchScanStage({ scanner, storage, work, queries }),
      DECODE: new ImageSearchDecodeStage({
        normalizer,
        storage: storageResource,
        work,
        queries,
      }),
      OCR: new ImageSearchOcrStage({
        ocr,
        storage: storageResource,
        work,
        queries,
      }),
      INTERPRET: new ImageSearchInterpretStage({
        validators: { deterministic, external: null },
        storage: storageResource,
        work,
        fallback: new CreateImageSearchFallbackService(),
      }),
    };
    const previousModel = process.env.OCR_MODEL_SHA256;
    process.env.OCR_MODEL_SHA256 = "a".repeat(64);
    try {
      for (const stage of ["SCAN", "DECODE", "OCR", "INTERPRET"] as const) {
        const at = new Date(base.getTime() + 100);
        const claims = await work.claimStage({
          stage,
          owner,
          now: at,
          leaseMs: 30_000,
          limit: 2,
        });
        expect(
          claims,
          `${stage}:${JSON.stringify(await queries.currentStatus(admitted.query.id))}`,
        ).toHaveLength(1);
        const claim = claims[0]!;
        if (stage === "SCAN") await stages.SCAN.process(claim, at);
        else
          await stages[stage].process(claim, at, new AbortController().signal);
      }
    } finally {
      process.env.OCR_MODEL_SHA256 = previousModel;
    }

    expect(await queries.currentStatus(admitted.query.id)).toMatchObject({
      status: "RESULT_READY",
    });
    expect(
      await prisma.searchIntentAttempt.findFirst({
        where: { queryId: admitted.query.id },
        select: { status: true, proposalCount: true },
      }),
    ).toMatchObject({ status: "SUCCEEDED", proposalCount: 4 });
    expect(
      await prisma.ocrUnitOutcome.findFirst({
        where: { attempt: { searchQueryId: admitted.query.id } },
        select: { status: true, sourceMethod: true },
      }),
    ).toEqual({ status: "OCR_SUCCEEDED", sourceMethod: "OCR" });
  });
});
