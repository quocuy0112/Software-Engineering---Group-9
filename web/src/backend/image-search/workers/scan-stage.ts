import "server-only";

import { randomUUID } from "node:crypto";

import type { MalwareScanner } from "@/backend/cv/scanning/malware-scanner";
import { prisma } from "@/backend/database/prisma";
import { readSearchArtifact } from "@/backend/image-search/storage/artifact-io";
import { readSearchArtifactEnvelope } from "@/backend/image-search/storage/prisma-artifact-envelope";
import type { PrivateSearchArtifactStorage } from "@/backend/image-search/storage/private-search-storage";
import {
  PrismaImageSearchWorkRepository,
  type ImageSearchWorkClaim,
} from "@/backend/repositories/image-search/prisma-image-search-work-repository";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";

export class ImageSearchScanStage {
  constructor(
    private readonly dependencies: Readonly<{
      scanner: MalwareScanner & {
        assessmentMetadata?(): Readonly<{
          engineVersion: string;
          signatureVersion: string;
          publishedAt: Date;
        }> | null;
      };
      storage: PrivateSearchArtifactStorage;
      work: PrismaImageSearchWorkRepository;
      queries: PrismaImageSearchQueryRepository;
    }>,
  ) {}

  async process(claim: ImageSearchWorkClaim, now: Date) {
    const row = await prisma.searchScanAssessment.findUnique({
      where: { id: claim.id },
      select: {
        id: true,
        queryId: true,
        sourceArtifactId: true,
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
      row.sourceArtifact.kind !== "SOURCE_IMAGE" ||
      row.sourceArtifact.status !== "QUARANTINED"
    )
      throw new Error("STAGE_RESULT_DISCARDED");
    const envelope = await readSearchArtifactEnvelope(row.sourceArtifactId);
    if (!envelope) throw new Error("STAGE_RESULT_DISCARDED");
    try {
      const bytes = await readSearchArtifact({
        storage: this.dependencies.storage,
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
      const result = await this.dependencies.scanner.scan(
        (async function* () {
          yield bytes;
        })(),
      );
      await this.dependencies.work.assertCommitAllowed({ claim, now });
      const metadata = this.dependencies.scanner.assessmentMetadata?.() ?? null;
      if (result.outcome === "INFECTED") {
        await prisma.searchScanAssessment.update({
          where: { id: claim.id },
          data: {
            status: "INFECTED",
            failureCode: "MALWARE_DETECTED",
            completedAt: now,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        await this.dependencies.queries.makeContentInaccessible({
          queryId: row.queryId,
          now,
          status: "INFECTED",
          failureCode: "MALWARE_DETECTED",
        });
        return;
      }
      await prisma.$transaction(async (transaction) => {
        const updated = await transaction.searchScanAssessment.updateMany({
          where: {
            id: claim.id,
            status: "PROCESSING",
            leaseOwner: claim.leaseOwner,
            leaseExpiresAt: { gt: now },
            query: {
              status: "SCANNING",
              contentInaccessibleAt: null,
              deleteBy: { gt: now },
            },
          },
          data: {
            status: "CLEAN",
            engineName: "clamav",
            engineVersion: metadata?.engineVersion ?? result.engineVersion,
            signatureVersion: metadata?.signatureVersion,
            signaturePublishedAt: metadata?.publishedAt,
            completedAt: now,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
        if (updated.count !== 1) throw new Error("STAGE_RESULT_DISCARDED");
        await transaction.searchStoredArtifact.update({
          where: { id: row.sourceArtifactId },
          data: { status: "AVAILABLE", availableAt: now },
          select: { id: true },
        });
        await transaction.searchImageDecodeAttempt.create({
          data: {
            id: randomUUID(),
            queryId: row.queryId,
            sourceArtifactId: row.sourceArtifactId,
            scanAssessmentId: row.id,
            attemptNumber: 1,
            status: "QUEUED",
          },
        });
        await transaction.searchImageQuery.update({
          where: { id: row.queryId },
          data: { status: "DECODE_QUEUED" },
          select: { id: true },
        });
      });
    } catch (error) {
      const code = (error as Error).message;
      if (code === "STAGE_RESULT_DISCARDED") throw error;
      const failureCode = code.includes("DEFINITIONS_STALE")
        ? "SCANNER_DEFINITIONS_STALE"
        : "SCANNER_UNAVAILABLE";
      await prisma.searchScanAssessment.updateMany({
        where: { id: claim.id, leaseOwner: claim.leaseOwner },
        data: {
          status: "INDETERMINATE",
          failureCode,
          completedAt: now,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      await this.dependencies.queries.makeContentInaccessible({
        queryId: row.queryId,
        now,
        status: "SCAN_FAILED",
        failureCode,
      });
    }
  }
}
