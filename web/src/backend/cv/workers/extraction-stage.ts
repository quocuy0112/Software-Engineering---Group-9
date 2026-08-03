import "server-only";

import { randomUUID } from "node:crypto";

import type {
  IntegrityVerifiedArtifact,
  IntegrityVerifiedReader,
} from "@/backend/cv/encryption/integrity-verified-reader";
import { IsolatedDocumentExtractor } from "@/backend/cv/extraction/document-extractor";
import { ExtractedSegmentStore } from "@/backend/cv/extraction/extracted-segment-store";
import type { PrivateCvStorage } from "@/backend/cv/storage/private-cv-storage";
import { prisma } from "@/backend/database/prisma";
import {
  assertCvStageResultCommitAllowed,
  PrismaCvWorkRepository,
  type CvStageResultCommitGuard,
  type CvWorkClaim,
} from "@/backend/repositories/cv-import/prisma-cv-work-repository";
import {
  cvStageCurrentTime,
  type CvStageOutcome,
  type CvStageProcessContext,
} from "./pipeline";
import {
  createCvWorkerCryptor,
  createCvWorkerIntegrityReader,
  createCvWorkerStorage,
  cvWorkerDatabaseTimestamp,
  readCvWorkerArtifactBytes,
} from "./cv-worker-resources";

const REJECTED_CONTENT_RETENTION_MS = 24 * 60 * 60_000;

type Dependencies = Readonly<{
  storage: PrivateCvStorage;
  reader: IntegrityVerifiedReader;
  extractor: IsolatedDocumentExtractor;
  segments: ExtractedSegmentStore;
}>;

function defaults(): Dependencies {
  const storage = createCvWorkerStorage();
  const cryptor = createCvWorkerCryptor();
  return {
    storage,
    reader: createCvWorkerIntegrityReader(storage, cryptor),
    extractor: new IsolatedDocumentExtractor(),
    segments: new ExtractedSegmentStore({ storage, cryptor }),
  };
}

function errorCode(error: unknown): string {
  if (error instanceof Error && "code" in error) return String(error.code);
  return error instanceof Error ? error.message : "";
}

function safeFailure(error: unknown) {
  const code = errorCode(error);
  const mapping: Record<string, string> = {
    ENCRYPTED: "DOCUMENT_ENCRYPTED",
    ACTIVE_CONTENT: "DOCUMENT_ACTIVE_CONTENT",
    EMBEDDED_CONTENT: "DOCUMENT_ACTIVE_CONTENT",
    PAGE_LIMIT: "DOCUMENT_LIMIT_EXCEEDED",
    ENTRY_LIMIT: "DOCUMENT_LIMIT_EXCEEDED",
    EXPANDED_LIMIT: "DOCUMENT_LIMIT_EXCEEDED",
    ZIP_BOMB: "DOCUMENT_LIMIT_EXCEEDED",
    OUTPUT_LIMIT: "DOCUMENT_LIMIT_EXCEEDED",
    IMAGE_ONLY: "EXTRACTION_EMPTY",
    EMPTY_TEXT: "EXTRACTION_EMPTY",
    EXTRACTION_TIMEOUT: "EXTRACTION_TIMEOUT",
  };
  return mapping[code] ?? "EXTRACTION_FAILED";
}

function isIntegrityFailure(error: unknown): boolean {
  return errorCode(error) === "ARTIFACT_INTEGRITY_FAILED";
}

async function persistInaccessibleFailure(input: {
  uploadId: string;
  accountId: string;
  uploadStatus: "VALIDATION_FAILED" | "EXTRACTION_FAILED";
  failureCode: string;
  now: Date;
  commitGuard: CvStageResultCommitGuard;
}) {
  const contentInaccessibleAt = cvWorkerDatabaseTimestamp(input.now);
  const deleteAfter = cvWorkerDatabaseTimestamp(
    new Date(input.now.getTime() + REJECTED_CONTENT_RETENTION_MS),
  );
  await prisma.$transaction(async (transaction) => {
    await assertCvStageResultCommitAllowed(transaction, input.commitGuard);
    await transaction.cvStoredArtifact.updateMany({
      where: {
        uploadId: input.uploadId,
        accountId: input.accountId,
        deletedAt: null,
        status: {
          in: ["QUARANTINED", "AVAILABLE", "DELETE_PENDING", "DELETE_FAILED"],
        },
      },
      data: {
        status: "DELETE_PENDING",
        contentInaccessibleAt,
        deleteAfter,
        deleteFailureCode: input.failureCode,
      },
    });
    await transaction.cvUpload.updateMany({
      where: { id: input.uploadId, accountId: input.accountId },
      data: {
        status: input.uploadStatus,
        failureCode: input.failureCode,
        contentInaccessibleAt,
        deleteAfter,
      },
    });
  });
}

export class ExtractionStageProcessor {
  constructor(
    private readonly dependencies: Dependencies = defaults(),
    private readonly workRepository: Pick<
      PrismaCvWorkRepository,
      "assertStageResultCommitAllowed"
    > = new PrismaCvWorkRepository(),
  ) {}

  async process(
    claim: CvWorkClaim,
    context: CvStageProcessContext,
  ): Promise<CvStageOutcome> {
    if (context.signal.aborted) throw new Error("CV_WORKER_ABORTED");
    const work = await prisma.cvExtraction.findFirst({
      where: {
        id: claim.id,
        uploadId: claim.uploadId,
        accountId: claim.accountId,
        status: "PROCESSING",
        leaseOwner: claim.leaseOwner,
      },
      select: {
        id: true,
        uploadId: true,
        accountId: true,
        upload: {
          select: {
            documentKind: true,
            parserClass: true,
          },
        },
        sourceArtifact: {
          select: {
            id: true,
            storageLocator: true,
            encryptionKeyVersion: true,
            plaintextBytes: true,
            ciphertextBytes: true,
          },
        },
        scanAssessment: {
          select: {
            status: true,
            sourceArtifactId: true,
          },
        },
      },
    });
    if (!work) throw new Error("CV_LEASE_LOST");
    if (
      work.scanAssessment.status !== "CLEAN" ||
      work.scanAssessment.sourceArtifactId !== work.sourceArtifact.id
    )
      throw new Error("CV_EXTRACTION_REQUIRES_CLEAN_SCAN");
    const artifact = work.sourceArtifact;
    const artifactBytes = await readCvWorkerArtifactBytes({
      artifactId: artifact.id,
      uploadId: work.uploadId,
      accountId: work.accountId,
    });
    if (
      !artifactBytes.sourceSha256 ||
      !artifactBytes.sourceSha256.equals(artifactBytes.plaintextSha256)
    ) {
      const completion = cvStageCurrentTime(context);
      await persistInaccessibleFailure({
        uploadId: work.uploadId,
        accountId: work.accountId,
        uploadStatus: "VALIDATION_FAILED",
        failureCode: "ARTIFACT_INTEGRITY_FAILED",
        now: completion,
        commitGuard: this.resultCommitGuard(claim, completion),
      });
      return {
        status: "FAILED",
        failureCode: "ARTIFACT_INTEGRITY_FAILED",
      };
    }
    await this.dependencies.storage.assertReady();
    let verified: IntegrityVerifiedArtifact | undefined;
    try {
      verified = await this.dependencies.reader.verify({
        locator: artifact.storageLocator,
        ciphertextBytes: artifact.ciphertextBytes,
        plaintextBytes: artifact.plaintextBytes,
        plaintextSha256: artifactBytes.plaintextSha256,
        context: {
          accountId: work.accountId,
          uploadId: work.uploadId,
          artifactId: artifact.id,
          kind: "SOURCE_DOCUMENT",
        },
        envelope: {
          keyVersion: artifact.encryptionKeyVersion,
          iv: artifactBytes.encryptionIv,
          authenticationTag: artifactBytes.authenticationTag,
        },
      });
      await prisma.cvUpload.updateMany({
        where: {
          id: work.uploadId,
          accountId: work.accountId,
          status: { in: ["EXTRACTION_QUEUED", "EXTRACTING"] },
          expiresAt: { gt: context.now },
          contentInaccessibleAt: null,
          deletedAt: null,
        },
        data: { status: "EXTRACTING" },
      });
      const extracted = await this.dependencies.extractor.extract({
        kind: work.upload.documentKind,
        scanStatus: "CLEAN",
        source: verified.open(),
      });
      await this.assertResultCommitAllowed(claim, context);
      const stored = await this.dependencies.segments.writeEncrypted({
        accountId: work.accountId,
        uploadId: work.uploadId,
        extractionId: work.id,
        segments: extracted.segments,
        commitGuard: {
          stage: "EXTRACTION",
          id: claim.id,
          uploadId: claim.uploadId,
          accountId: claim.accountId,
          owner: claim.leaseOwner,
          currentTime: () => cvStageCurrentTime(context),
        },
      });
      await prisma.$transaction(async (transaction) => {
        const completion = cvStageCurrentTime(context);
        await assertCvStageResultCommitAllowed(
          transaction,
          this.resultCommitGuard(claim, completion),
        );
        await transaction.cvExtraction.update({
          where: { id: work.id },
          data: {
            extractorName:
              work.upload.documentKind === "PDF" ? "pdfjs" : "mammoth",
            extractorVersion: "feature-004-v1",
            rulesVersion: "cv-structure-v1",
            pageCount: extracted.pageCount,
            entryCount: extracted.entryCount,
            expandedBytes: extracted.expandedBytes,
            segmentCount: stored.segmentCount,
            extractedUtf8Bytes: stored.utf8Bytes,
          },
          select: { id: true },
        });
        if (work.upload.parserClass === "EXTERNAL_OPENAI") {
          await transaction.cvUpload.update({
            where: { id: work.uploadId },
            data: {
              status: "AWAITING_CONSENT",
              failureCode: "CONSENT_REQUIRED",
            },
            select: { id: true },
          });
          return;
        }
        const active = await transaction.cvParseJob.findFirst({
          where: {
            accountId: work.accountId,
            status: { in: ["QUEUED", "PROCESSING"] },
          },
          select: { id: true },
        });
        if (!active)
          await transaction.cvParseJob.create({
            data: {
              id: randomUUID(),
              uploadId: work.uploadId,
              extractionId: work.id,
              accountId: work.accountId,
              attemptNumber: 1,
              trigger: "INITIAL",
              status: "QUEUED",
              parserClass: "DETERMINISTIC_INTERNAL",
              provider: "smarthire",
              model: "deterministic-v1",
              purposeVersion: "cv-draft-purpose-v1",
              inputVersion: "cv-segments-v1",
              instructionVersion: "cv-extract-v1",
              schemaVersion: "cv-draft-v1",
            },
            select: { id: true },
          });
        await transaction.cvUpload.update({
          where: { id: work.uploadId },
          data: { status: "PARSE_QUEUED", failureCode: null },
          select: { id: true },
        });
      });
      return { status: "SUCCEEDED" };
    } catch (error) {
      if (errorCode(error) === "CV_WORKER_ABORTED") throw error;
      if (errorCode(error) === "CV_STAGE_RESULT_DISCARDED") throw error;
      const integrityFailure = isIntegrityFailure(error);
      const failureCode = safeFailure(error);
      const completion = cvStageCurrentTime(context);
      await persistInaccessibleFailure({
        uploadId: work.uploadId,
        accountId: work.accountId,
        uploadStatus: integrityFailure
          ? "VALIDATION_FAILED"
          : "EXTRACTION_FAILED",
        failureCode: integrityFailure
          ? "ARTIFACT_INTEGRITY_FAILED"
          : failureCode,
        now: completion,
        commitGuard: this.resultCommitGuard(claim, completion),
      });
      return {
        status: "FAILED",
        failureCode: integrityFailure
          ? "ARTIFACT_INTEGRITY_FAILED"
          : failureCode,
      };
    } finally {
      await verified?.dispose();
    }
  }

  private resultCommitGuard(
    claim: CvWorkClaim,
    now: Date,
  ): CvStageResultCommitGuard {
    return {
      stage: "EXTRACTION",
      id: claim.id,
      uploadId: claim.uploadId,
      accountId: claim.accountId,
      owner: claim.leaseOwner,
      now,
    };
  }

  private async assertResultCommitAllowed(
    claim: CvWorkClaim,
    context: CvStageProcessContext,
  ): Promise<void> {
    await this.workRepository.assertStageResultCommitAllowed(
      this.resultCommitGuard(claim, cvStageCurrentTime(context)),
    );
  }
}
