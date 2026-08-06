import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/backend/database/prisma";
import { OCR_EXPECTED_MODEL_MANIFEST_SHA256 } from "@/backend/image-search/config";
import {
  readSearchArtifact,
  oneChunk,
} from "@/backend/image-search/storage/artifact-io";
import { readSearchArtifactEnvelope } from "@/backend/image-search/storage/prisma-artifact-envelope";
import type { SearchStorageResource } from "@/backend/image-search/storage/factory";
import type { SearchArtifactLocator } from "@/backend/image-search/storage/private-search-storage";
import type { OcrEngine } from "@/backend/ocr/ocr-engine";
import {
  PrismaImageSearchWorkRepository,
  type ImageSearchWorkClaim,
} from "@/backend/repositories/image-search/prisma-image-search-work-repository";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";

type SearchOcrText = Readonly<{
  schemaVersion: "search-ocr-text-v1";
  text: string;
  language: "VI" | "EN" | "BILINGUAL" | "UNKNOWN";
  warnings: readonly "LOW_CONFIDENCE"[];
}>;

function detectLanguage(text: string): SearchOcrText["language"] {
  const vietnamese =
    /[\u0102\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01A0-\u01B0\u1EA0-\u1EF9]/u.test(
      text,
    );
  const english =
    /\b(?:the|and|job|experience|skills?|location|salary|remote)\b/iu.test(
      text,
    );
  return vietnamese && english
    ? "BILINGUAL"
    : vietnamese
      ? "VI"
      : english
        ? "EN"
        : "UNKNOWN";
}

async function withDeadline<T>(input: {
  deadline: Date;
  parentSignal: AbortSignal;
  run(signal: AbortSignal): Promise<T>;
}) {
  const remaining = input.deadline.getTime() - Date.now();
  if (remaining <= 0) throw new Error("OCR_DEADLINE_EXCEEDED");
  const controller = new AbortController();
  const parentAbort = () => controller.abort();
  input.parentSignal.addEventListener("abort", parentAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), remaining);
  timeout.unref();
  try {
    return await Promise.race([
      input.run(controller.signal),
      new Promise<never>((_resolve, reject) =>
        controller.signal.addEventListener(
          "abort",
          () => reject(new Error("OCR_DEADLINE_EXCEEDED")),
          { once: true },
        ),
      ),
    ]);
  } finally {
    clearTimeout(timeout);
    input.parentSignal.removeEventListener("abort", parentAbort);
  }
}

function failureCode(error: unknown) {
  const code =
    error instanceof Error && "code" in error
      ? String(error.code)
      : (error as Error).message;
  if (code === "OCR_DEADLINE_EXCEEDED") return "OCR_UNAVAILABLE";
  if (code === "OCR_MODEL_MISMATCH") return "OCR_UNAVAILABLE";
  if (code === "SEARCH_OCR_OUTPUT_TOO_LARGE") return "OCR_OUTPUT_TOO_LARGE";
  return "OCR_UNAVAILABLE";
}

export class ImageSearchOcrStage {
  constructor(
    private readonly dependencies: Readonly<{
      ocr: OcrEngine;
      storage: SearchStorageResource;
      work: PrismaImageSearchWorkRepository;
      queries: PrismaImageSearchQueryRepository;
    }>,
  ) {}

  async process(claim: ImageSearchWorkClaim, now: Date, signal: AbortSignal) {
    const row = await prisma.ocrProcessingAttempt.findUnique({
      where: { id: claim.id },
      select: {
        id: true,
        purpose: true,
        searchQueryId: true,
        startedAt: true,
        searchQuery: {
          select: {
            id: true,
            deleteBy: true,
            interpreterClass: true,
            decodeAttempts: {
              where: { status: "SUCCEEDED" },
              orderBy: { attemptNumber: "desc" },
              take: 1,
              select: {
                normalizedArtifactId: true,
                width: true,
                height: true,
                decodedPixels: true,
                normalizedArtifact: {
                  select: {
                    kind: true,
                    status: true,
                    storageLocator: true,
                    plaintextBytes: true,
                  },
                },
              },
            },
            consentEvents: {
              orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
              take: 1,
              select: { id: true, action: true },
            },
          },
        },
      },
    });
    const searchQuery = row?.searchQuery;
    const decode = searchQuery?.decodeAttempts[0];
    const artifact = decode?.normalizedArtifact;
    if (
      !row ||
      !searchQuery ||
      row.purpose !== "JOB_IMAGE_SEARCH" ||
      row.searchQueryId !== claim.queryId ||
      !decode?.normalizedArtifactId ||
      !artifact ||
      artifact.kind !== "NORMALIZED_IMAGE" ||
      artifact.status !== "AVAILABLE" ||
      !decode.width ||
      !decode.height ||
      !decode.decodedPixels
    )
      throw new Error("STAGE_RESULT_DISCARDED");
    const envelope = await readSearchArtifactEnvelope(
      decode.normalizedArtifactId,
    );
    if (!envelope) throw new Error("STAGE_RESULT_DISCARDED");
    const deadline = new Date((row.startedAt ?? now).getTime() + 6_000);
    let unattachedLocator: SearchArtifactLocator | null = null;
    try {
      await this.dependencies.ocr.assertReady(
        OCR_EXPECTED_MODEL_MANIFEST_SHA256,
      );
      const bytes = await readSearchArtifact({
        storage: this.dependencies.storage.storage,
        locator: artifact.storageLocator,
        authenticationTag: envelope.authenticationTag,
        context: {
          queryId: claim.queryId,
          artifactId: decode.normalizedArtifactId,
          kind: "NORMALIZED_IMAGE",
        },
        expectedBytes: artifact.plaintextBytes,
        expectedSha256: envelope.plaintextSha256,
        maximumBytes: 25 * 1024 * 1024,
      });
      const recognition = await withDeadline({
        deadline:
          deadline < searchQuery.deleteBy ? deadline : searchQuery.deleteBy,
        parentSignal: signal,
        run: (childSignal) =>
          this.dependencies.ocr.recognize({
            attemptId: row.id,
            purpose: "JOB_IMAGE_SEARCH",
            image: {
              bytes,
              width: decode.width!,
              height: decode.height!,
              decodedPixels: decode.decodedPixels!,
              sha256: createHash("sha256").update(bytes).digest(),
            },
            deadline,
            expectedModelManifestSha256: OCR_EXPECTED_MODEL_MANIFEST_SHA256,
            signal: childSignal,
          }),
      });
      const text = recognition.lines
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((line) => line.text.normalize("NFKC").trim())
        .filter(Boolean)
        .join("\n");
      if (!text) throw new Error("OCR_LOW_CONFIDENCE");
      const lowConfidence = (recognition.summary.averageConfidence ?? 0) < 0.6;
      const payload: SearchOcrText = {
        schemaVersion: "search-ocr-text-v1",
        text,
        language: detectLanguage(text),
        warnings: lowConfidence ? ["LOW_CONFIDENCE"] : [],
      };
      const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
      if (payloadBytes.byteLength > 32 * 1024)
        throw new Error("SEARCH_OCR_OUTPUT_TOO_LARGE");
      const commitNow = new Date();
      await this.dependencies.work.assertCommitAllowed({
        claim,
        now: commitNow,
      });
      const artifactId = randomUUID();
      const stored = await this.dependencies.storage.storage.put({
        source: oneChunk(payloadBytes),
        expectedBytes: payloadBytes.byteLength,
        context: {
          queryId: claim.queryId,
          artifactId,
          kind: "OCR_TEXT",
        },
      });
      unattachedLocator = stored.locator;
      await prisma.$transaction(async (transaction) => {
        const committed = await transaction.ocrProcessingAttempt.updateMany({
          where: {
            id: claim.id,
            purpose: "JOB_IMAGE_SEARCH",
            searchQueryId: claim.queryId,
            status: "PROCESSING",
            leaseOwner: claim.leaseOwner,
            leaseExpiresAt: { gt: commitNow },
            searchQuery: {
              status: "OCR_PROCESSING",
              contentInaccessibleAt: null,
              deleteBy: { gt: commitNow },
            },
          },
          data: {
            status: lowConfidence ? "PARTIAL_REVIEW_REQUIRED" : "SUCCEEDED",
            succeededUnitCount: lowConfidence ? 0 : 1,
            reviewUnitCount: lowConfidence ? 1 : 0,
            outputLineCount: recognition.summary.lineCount,
            outputUtf8Bytes: Buffer.byteLength(text, "utf8"),
            completedAt: commitNow,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        if (committed.count !== 1) throw new Error("STAGE_RESULT_DISCARDED");
        await transaction.ocrUnitOutcome.create({
          data: {
            id: randomUUID(),
            attemptId: claim.id,
            unitKey: "search-image-1",
            ordinal: 0,
            kind: "SEARCH_IMAGE",
            status: lowConfidence ? "LOW_CONFIDENCE" : "OCR_SUCCEEDED",
            sourceMethod: "OCR",
            anchorQuality: "NOT_APPLICABLE",
            averageConfidence: recognition.summary.averageConfidence,
            minimumConfidence: recognition.summary.minimumConfidence,
            recognizedCharacterCount: Array.from(text).length,
            segmentCount: recognition.lines.length,
          },
        });
        await transaction.searchStoredArtifact.create({
          data: {
            id: artifactId,
            queryId: claim.queryId,
            kind: "OCR_TEXT",
            status: "AVAILABLE",
            storageAdapter: this.dependencies.storage.adapterName,
            storageLocator: String(stored.locator),
            encryptionKeyVersion: stored.encryptionKeyVersion,
            encryptionIv: Buffer.from(stored.encryptionIv),
            authenticationTag: Buffer.from(stored.authenticationTag),
            plaintextBytes: stored.plaintextBytes,
            ciphertextBytes: stored.ciphertextBytes,
            plaintextSha256: Buffer.from(stored.plaintextSha256),
            availableAt: commitNow,
            deleteBy: searchQuery.deleteBy,
          },
          select: { id: true },
        });
        if (lowConfidence) {
          await transaction.searchImageQuery.update({
            where: { id: claim.queryId },
            data: {
              status: "FALLBACK_READY",
              resultKind: "OCR_TEXT_FALLBACK",
              resultReadyAt: commitNow,
            },
            select: { id: true },
          });
          return;
        }
        const latestConsent = searchQuery.consentEvents[0];
        const external = searchQuery.interpreterClass === "EXTERNAL_OPENAI";
        const consentGranted = latestConsent?.action === "GRANTED";
        if (external && !consentGranted) {
          await transaction.searchImageQuery.update({
            where: { id: claim.queryId },
            data: {
              status: "AWAITING_CONSENT",
              failureCode: "CONSENT_REQUIRED",
            },
            select: { id: true },
          });
          return;
        }
        await transaction.searchIntentAttempt.create({
          data: {
            id: randomUUID(),
            queryId: claim.queryId,
            ocrAttemptId: claim.id,
            ocrTextArtifactId: artifactId,
            consentEventId: external ? latestConsent?.id : null,
            attemptNumber: 1,
            status: "QUEUED",
            interpreterClass: searchQuery.interpreterClass,
            provider: external ? "openai" : "smarthire",
            model: external
              ? (process.env.IMAGE_SEARCH_OPENAI_MODEL ?? "")
              : "deterministic-v1",
            purposeVersion: "job-image-search-purpose-v1",
            inputVersion: "search-ocr-text-v1",
            instructionVersion: "job-search-intent-v1",
            schemaVersion: "job-search-intent-v1",
            selectionPolicyVersion: "search-intent-selection-v1",
          },
        });
        await transaction.searchImageQuery.update({
          where: { id: claim.queryId },
          data: { status: "INTERPRET_QUEUED", failureCode: null },
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
      const safeCode = failureCode(error);
      await prisma.ocrProcessingAttempt.updateMany({
        where: { id: claim.id, leaseOwner: claim.leaseOwner },
        data: {
          status: "FAILED",
          failedUnitCount: 1,
          failureCode: safeCode,
          completedAt: now,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      await this.dependencies.queries.makeContentInaccessible({
        queryId: claim.queryId,
        now,
        status: "OCR_FAILED",
        failureCode: safeCode,
      });
    }
  }
}
