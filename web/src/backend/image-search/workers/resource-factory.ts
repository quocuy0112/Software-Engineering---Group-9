import "server-only";

import { randomUUID } from "node:crypto";

import { ClamAvScanner } from "@/backend/cv/scanning/clamav";
import { createSearchStorageResource } from "@/backend/image-search/storage/factory";
import { OpenAiSearchIntentInterpreter } from "@/backend/image-search/interpretation/openai";
import { SearchIntentSelectionPolicy } from "@/backend/image-search/interpretation/selection-policy";
import { SharpImageNormalizer } from "@/backend/ocr/image-normalizer";
import { UnixOcrEngine } from "@/backend/ocr/unix-ocr-engine";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";
import { PrismaImageSearchWorkRepository } from "@/backend/repositories/image-search/prisma-image-search-work-repository";
import { CreateImageSearchFallbackService } from "@/backend/services/image-search/create-image-search-fallback";
import { ValidateSearchIntentService } from "@/backend/services/image-search/validate-search-intent";
import { ImageSearchCleanupWorker } from "./cleanup";
import { ImageSearchDecodeStage } from "./decode-stage";
import { ImageSearchInterpretStage } from "./interpret-stage";
import { ImageSearchOcrStage } from "./ocr-stage";
import { ImageSearchReconciliationWorker } from "./reconciliation";
import { ImageSearchScanStage } from "./scan-stage";

export function createImageSearchWorkerResources() {
  const storage = createSearchStorageResource();
  const work = new PrismaImageSearchWorkRepository();
  const queries = new PrismaImageSearchQueryRepository();
  const scanner = new ClamAvScanner({
    socketPath: process.env.CV_CLAMD_SOCKET_PATH ?? "/run/clamav/clamd.sock",
    maximumBytes: 5_000_000,
  });
  const normalizer = new SharpImageNormalizer({
    assertCleanAssessment: async (assessmentId, purpose) => {
      if (purpose !== "JOB_IMAGE_SEARCH")
        throw new Error("IMAGE_NORMALIZATION_PURPOSE_INVALID");
      const { prisma } = await import("@/backend/database/prisma");
      const clean = await prisma.searchScanAssessment.findFirst({
        where: { id: assessmentId, status: "CLEAN" },
        select: { id: true },
      });
      if (!clean) throw new Error("IMAGE_NORMALIZATION_REQUIRES_CLEAN_SCAN");
    },
  });
  const ocr = new UnixOcrEngine({
    socketPath: "/run/smarthire-ocr/ocr.sock",
    expectedEngineName: "paddleocr-onnx",
    expectedEngineVersion: "1.0.0",
    expectedModelName: "PP-OCRv6-medium",
  });
  const selectionPolicy = new SearchIntentSelectionPolicy();
  const externalValidator = new ValidateSearchIntentService({
    interpreter: new OpenAiSearchIntentInterpreter({
      // Image search intentionally shares the server-only CV parsing key. It
      // has no separate browser-visible or image-search-specific credential.
      apiKey: process.env.OPENAI_API_KEY ?? "",
    }),
    selectionPolicy,
  });
  const owner = `image-search-worker:${randomUUID()}`;
  return {
    owner,
    work,
    storage,
    stages: {
      SCAN: new ImageSearchScanStage({
        scanner,
        storage: storage.storage,
        work,
        queries,
      }),
      DECODE: new ImageSearchDecodeStage({
        normalizer,
        storage,
        work,
        queries,
      }),
      OCR: new ImageSearchOcrStage({ ocr, storage, work, queries }),
      INTERPRET: new ImageSearchInterpretStage({
        validators: {
          deterministic: null,
          external: externalValidator,
        },
        storage,
        work,
        fallback: new CreateImageSearchFallbackService(),
      }),
    },
    cleanup: new ImageSearchCleanupWorker({
      storage: storage.storage,
      owner: `${owner}:cleanup`,
    }),
    reconciliation: new ImageSearchReconciliationWorker(),
  } as const;
}
