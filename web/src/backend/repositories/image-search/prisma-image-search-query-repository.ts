import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/backend/database/prisma";
import type { ImageSearchActor } from "@/backend/security/image-search-request-boundary";
import { verifyVisitorCapability } from "@/backend/security/image-search-request-boundary";
import type { StoredSearchArtifact } from "@/backend/image-search/storage/private-search-storage";

const INACCESSIBLE_STATES = new Set([
  "VALIDATION_FAILED",
  "INFECTED",
  "SCAN_FAILED",
  "DECODE_FAILED",
  "OCR_FAILED",
  "INTERPRET_FAILED",
  "CONSUMED",
  "CANCELLED",
  "EXPIRED",
  "DELETED",
]);

export type AuthorizedImageSearchQuery = Readonly<{
  id: string;
  actorClass: "VISITOR" | "AUTHENTICATED";
  accountId: string | null;
  status: string;
  interpreterClass: "DETERMINISTIC_INTERNAL" | "EXTERNAL_OPENAI";
  declaredExtension: string;
  declaredMediaType: string;
  declaredBytes: number;
  admittedAt: Date;
  expiresAt: Date;
  deleteBy: Date;
  failureCode: string | null;
  resultKind: "VALIDATED_INTENT" | "OCR_TEXT_FALLBACK" | null;
}>;

export class ImageSearchQueryRepositoryError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ImageSearchQueryRepositoryError";
  }
}

export class PrismaImageSearchQueryRepository {
  async authorize(input: {
    queryId: string;
    actor: ImageSearchActor;
    visitorCapability: string | null;
    capabilityHmacKey: Uint8Array;
    now: Date;
    allowInaccessible?: boolean;
  }): Promise<AuthorizedImageSearchQuery> {
    const row = await prisma.searchImageQuery.findUnique({
      where: { id: input.queryId },
      select: {
        id: true,
        actorClass: true,
        accountId: true,
        status: true,
        interpreterClass: true,
        declaredExtension: true,
        declaredMediaType: true,
        declaredBytes: true,
        admittedAt: true,
        expiresAt: true,
        deleteBy: true,
        failureCode: true,
        resultKind: true,
        contentInaccessibleAt: true,
      },
    });
    if (!row)
      throw new ImageSearchQueryRepositoryError("IMAGE_SEARCH_NOT_FOUND");
    const capabilityRows =
      row.actorClass === "VISITOR"
        ? await prisma.$queryRaw<Array<{ digestHex: string | null }>>`
            SELECT encode("visitorCapabilityDigest", 'hex') AS "digestHex"
              FROM "SearchImageQuery"
             WHERE "id" = ${row.id}
             LIMIT 1`
        : [];
    const visitorCapabilityDigest = capabilityRows[0]?.digestHex
      ? Buffer.from(capabilityRows[0].digestHex, "hex")
      : null;
    const owns =
      input.actor.kind === "AUTHENTICATED"
        ? row.actorClass === "AUTHENTICATED" &&
          row.accountId === input.actor.accountId
        : row.actorClass === "VISITOR" &&
          Boolean(visitorCapabilityDigest && input.visitorCapability) &&
          verifyVisitorCapability({
            queryId: row.id,
            capability: input.visitorCapability ?? "",
            expectedDigest: visitorCapabilityDigest ?? Buffer.alloc(0),
            capabilityHmacKey: input.capabilityHmacKey,
          });
    if (!owns)
      throw new ImageSearchQueryRepositoryError("IMAGE_SEARCH_NOT_FOUND");

    if (row.deleteBy <= input.now && !INACCESSIBLE_STATES.has(row.status)) {
      await this.makeContentInaccessible({
        queryId: row.id,
        now: input.now,
        status: "EXPIRED",
        failureCode: "QUERY_EXPIRED",
      });
      throw new ImageSearchQueryRepositoryError("QUERY_EXPIRED");
    }
    if (
      !input.allowInaccessible &&
      (row.contentInaccessibleAt || INACCESSIBLE_STATES.has(row.status))
    )
      throw new ImageSearchQueryRepositoryError(
        row.status === "EXPIRED" ? "QUERY_EXPIRED" : "IMAGE_SEARCH_NOT_FOUND",
      );
    return {
      id: row.id,
      actorClass: row.actorClass,
      accountId: row.accountId,
      status: row.status,
      interpreterClass: row.interpreterClass,
      declaredExtension: row.declaredExtension,
      declaredMediaType: row.declaredMediaType,
      declaredBytes: row.declaredBytes,
      admittedAt: row.admittedAt,
      expiresAt: row.expiresAt,
      deleteBy: row.deleteBy,
      failureCode: row.failureCode,
      resultKind: row.resultKind,
    };
  }

  async attachSourceAndQueueScan(input: {
    queryId: string;
    now: Date;
    artifactId: string;
    adapter: string;
    stored: StoredSearchArtifact;
  }) {
    return prisma.$transaction(async (transaction) => {
      const query = await transaction.searchImageQuery.findUnique({
        where: { id: input.queryId },
        select: {
          status: true,
          declaredBytes: true,
          deleteBy: true,
          contentInaccessibleAt: true,
          artifacts: {
            where: { kind: "SOURCE_IMAGE" },
            select: { id: true },
          },
        },
      });
      if (!query || query.contentInaccessibleAt || query.deleteBy <= input.now)
        throw new ImageSearchQueryRepositoryError("STAGE_RESULT_DISCARDED");
      if (query.status !== "AWAITING_CONTENT") {
        if (query.status === "SCAN_QUEUED" && query.artifacts.length === 1)
          return { replay: true } as const;
        throw new ImageSearchQueryRepositoryError("QUERY_STATE_CONFLICT");
      }
      if (input.stored.plaintextBytes !== query.declaredBytes)
        throw new ImageSearchQueryRepositoryError("CONTENT_LENGTH_MISMATCH");
      await transaction.searchStoredArtifact.create({
        data: {
          id: input.artifactId,
          queryId: input.queryId,
          kind: "SOURCE_IMAGE",
          status: "QUARANTINED",
          storageAdapter: input.adapter,
          storageLocator: String(input.stored.locator),
          encryptionKeyVersion: input.stored.encryptionKeyVersion,
          encryptionIv: Buffer.from(input.stored.encryptionIv),
          authenticationTag: Buffer.from(input.stored.authenticationTag),
          plaintextBytes: input.stored.plaintextBytes,
          ciphertextBytes: input.stored.ciphertextBytes,
          plaintextSha256: Buffer.from(input.stored.plaintextSha256),
          deleteBy: query.deleteBy,
        },
        select: { id: true },
      });
      await transaction.searchScanAssessment.create({
        data: {
          id: randomUUID(),
          queryId: input.queryId,
          sourceArtifactId: input.artifactId,
          attemptNumber: 1,
          status: "QUEUED",
        },
      });
      await transaction.searchImageQuery.update({
        where: { id: input.queryId },
        data: {
          status: "SCAN_QUEUED",
          actualBytes: input.stored.plaintextBytes,
          sourceSha256: Buffer.from(input.stored.plaintextSha256),
          contentReceivedAt: input.now,
        },
        select: { id: true },
      });
      return { replay: false } as const;
    });
  }

  async makeContentInaccessible(input: {
    queryId: string;
    now: Date;
    status:
      | "VALIDATION_FAILED"
      | "INFECTED"
      | "SCAN_FAILED"
      | "DECODE_FAILED"
      | "OCR_FAILED"
      | "INTERPRET_FAILED"
      | "CONSUMED"
      | "CANCELLED"
      | "EXPIRED";
    failureCode?: string | null;
  }) {
    await prisma.$transaction(async (transaction) => {
      const query = await transaction.searchImageQuery.findUnique({
        where: { id: input.queryId },
        select: {
          status: true,
          contentInaccessibleAt: true,
          deleteBy: true,
        },
      });
      if (!query) return;
      const inaccessibleAt = query.contentInaccessibleAt ?? input.now;
      await transaction.searchImageQuery.update({
        where: { id: input.queryId },
        data: {
          status: input.status,
          failureCode: input.failureCode ?? null,
          contentInaccessibleAt: inaccessibleAt,
          ...(input.status === "CONSUMED"
            ? { resultConsumedAt: input.now }
            : {}),
        },
        select: { id: true },
      });
      await transaction.searchStoredArtifact.updateMany({
        where: {
          queryId: input.queryId,
          status: { not: "DELETED" },
        },
        data: {
          status: "DELETE_PENDING",
          contentInaccessibleAt: inaccessibleAt,
          deleteAfter: input.now < query.deleteBy ? input.now : query.deleteBy,
          deleteLeaseOwner: null,
          deleteLeaseExpiresAt: null,
        },
      });
    });
  }

  async currentStatus(queryId: string) {
    return prisma.searchImageQuery.findUnique({
      where: { id: queryId },
      select: {
        id: true,
        status: true,
        admittedAt: true,
        expiresAt: true,
        failureCode: true,
        interpreterClass: true,
        consentEvents: {
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { action: true },
        },
      },
    });
  }
}
