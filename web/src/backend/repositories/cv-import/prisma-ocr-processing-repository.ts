import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/backend/database/prisma";
import type { CvExtractionManifest } from "@/shared/contracts/ocr/cv-extraction";
import type { CvHybridUnitOutcome } from "@/backend/cv/extraction/hybrid-segments";

type LeaseGuard = Readonly<{
  extractionId: string;
  uploadId: string;
  accountId: string;
  leaseOwner: string;
  now: Date;
}>;

async function assertLease(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  guard: LeaseGuard,
) {
  const active = await transaction.cvExtraction.findFirst({
    where: {
      id: guard.extractionId,
      uploadId: guard.uploadId,
      accountId: guard.accountId,
      status: "PROCESSING",
      leaseOwner: guard.leaseOwner,
      leaseExpiresAt: { gt: guard.now },
    },
    select: { id: true },
  });
  if (!active) throw new Error("CV_STAGE_RESULT_DISCARDED");
}

export class PrismaOcrProcessingRepository {
  async beginCvAttempt(
    input: LeaseGuard & {
      manifest: CvExtractionManifest;
      engineName: string;
      engineVersion: string;
      modelName: string;
      modelManifestSha256: string;
      runtimeName: string;
      runtimeVersion: string;
    },
  ) {
    return prisma.$transaction(async (transaction) => {
      await assertLease(transaction, input);
      const existing = await transaction.ocrProcessingAttempt.findUnique({
        where: { cvExtractionId: input.extractionId },
        select: { id: true, startedAt: true, status: true },
      });
      if (existing) {
        if (["SUCCEEDED", "PARTIAL_REVIEW_REQUIRED"].includes(existing.status))
          throw new Error("CV_OCR_ALREADY_COMPLETED");
        return transaction.ocrProcessingAttempt.update({
          where: { id: existing.id },
          data: {
            status: "PROCESSING",
            startedAt: existing.startedAt ?? input.now,
            failureCode: null,
          },
          select: { id: true, startedAt: true },
        });
      }
      const earliest = await transaction.ocrProcessingAttempt.findFirst({
        where: {
          purpose: "CV_IMPORT",
          cvExtraction: {
            uploadId: input.uploadId,
            accountId: input.accountId,
          },
          startedAt: { not: null },
        },
        orderBy: [{ startedAt: "asc" }, { createdAt: "asc" }],
        select: { startedAt: true },
      });
      return transaction.ocrProcessingAttempt.create({
        data: {
          id: randomUUID(),
          purpose: "CV_IMPORT",
          cvExtractionId: input.extractionId,
          status: "PROCESSING",
          engineName: input.engineName,
          engineVersion: input.engineVersion,
          modelName: input.modelName,
          modelSha256: Buffer.from(input.modelManifestSha256, "hex"),
          runtimeName: input.runtimeName,
          runtimeVersion: input.runtimeVersion,
          eligibilityPolicyVersion: input.manifest.eligibilityPolicyVersion,
          confidencePolicyVersion: "ocr-confidence-v1",
          inputUnitCount: input.manifest.units.length,
          startedAt: earliest?.startedAt ?? input.now,
        },
        select: { id: true, startedAt: true },
      });
    });
  }

  async completeCvAttempt(
    input: LeaseGuard & {
      attemptId: string;
      manifest: CvExtractionManifest;
      outcomes: readonly CvHybridUnitOutcome[];
      outputUtf8Bytes: number;
    },
  ) {
    if (input.outcomes.length !== input.manifest.units.length)
      throw new Error("CV_OCR_ACCOUNTING_INCOMPLETE");
    return prisma.$transaction(async (transaction) => {
      await assertLease(transaction, input);
      await transaction.ocrUnitOutcome.deleteMany({
        where: { attemptId: input.attemptId },
      });
      const byKey = new Map(
        input.manifest.units.map((unit) => [unit.unitKey, unit]),
      );
      await transaction.ocrUnitOutcome.createMany({
        data: input.outcomes.map((outcome) => {
          const unit = byKey.get(outcome.unitKey);
          if (!unit || unit.ordinal !== outcome.ordinal)
            throw new Error("CV_OCR_ACCOUNTING_INVALID");
          const status = outcome.materialConflict
            ? "CONFLICT"
            : outcome.status === "NATIVE_SUCCEEDED"
              ? "NATIVE_SUFFICIENT"
              : outcome.status === "OCR_SUCCEEDED"
                ? "OCR_SUCCEEDED"
                : outcome.status === "LOW_CONFIDENCE"
                  ? "LOW_CONFIDENCE"
                  : outcome.status === "NON_TEXT"
                    ? "NON_TEXT"
                    : unit.classification === "EXCLUDED_UNSUPPORTED_IMAGE"
                      ? "UNSUPPORTED"
                      : "EXCLUDED";
          return {
            id: randomUUID(),
            attemptId: input.attemptId,
            unitKey: unit.unitKey,
            ordinal: unit.ordinal,
            kind: unit.kind,
            status,
            sourceMethod: outcome.sourceMethod,
            pageNumber: unit.pageNumber,
            bodyOrdinal: unit.bodyOrdinal,
            imageOrdinal: unit.imageOrdinal,
            anchorQuality: unit.anchorQuality,
            averageConfidence: outcome.averageConfidence,
            minimumConfidence: outcome.minimumConfidence,
            recognizedCharacterCount: outcome.recognizedCharacterCount,
            segmentCount: outcome.segmentCount,
            deduplicatedSegmentCount: outcome.deduplicatedSegmentCount,
            materialConflict: outcome.materialConflict,
          };
        }),
      });
      const reviewUnitCount = input.outcomes.filter(
        (outcome) =>
          outcome.status === "LOW_CONFIDENCE" || outcome.materialConflict,
      ).length;
      const succeededUnitCount = input.outcomes.filter(
        (outcome) =>
          !outcome.materialConflict &&
          ["NATIVE_SUCCEEDED", "OCR_SUCCEEDED"].includes(outcome.status),
      ).length;
      const failedUnitCount = input.outcomes.filter(
        (outcome) =>
          !outcome.materialConflict &&
          ![
            "NATIVE_SUCCEEDED",
            "OCR_SUCCEEDED",
            "LOW_CONFIDENCE",
            "EXCLUDED",
            "NON_TEXT",
          ].includes(outcome.status),
      ).length;
      return transaction.ocrProcessingAttempt.update({
        where: { id: input.attemptId, cvExtractionId: input.extractionId },
        data: {
          status: reviewUnitCount ? "PARTIAL_REVIEW_REQUIRED" : "SUCCEEDED",
          succeededUnitCount,
          reviewUnitCount,
          failedUnitCount,
          outputLineCount: input.outcomes.reduce(
            (total, outcome) => total + outcome.recognizedLineCount,
            0,
          ),
          outputUtf8Bytes: input.outputUtf8Bytes,
          completedAt: input.now,
          failureCode: null,
        },
        select: { id: true, status: true },
      });
    });
  }

  async failCvAttempt(
    input: LeaseGuard & {
      attemptId: string;
      failureCode: string;
    },
  ) {
    await prisma.$transaction(async (transaction) => {
      await assertLease(transaction, input);
      await transaction.ocrProcessingAttempt.updateMany({
        where: {
          id: input.attemptId,
          cvExtractionId: input.extractionId,
          status: { in: ["QUEUED", "PROCESSING"] },
        },
        data: {
          status: "FAILED",
          failureCode: input.failureCode.slice(0, 100),
          completedAt: input.now,
        },
      });
    });
  }
}
