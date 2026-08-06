import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/backend/database/prisma";
import { FilesystemPrivateSearchArtifactStorage } from "@/backend/image-search/storage/filesystem";
import { oneChunk } from "@/backend/image-search/storage/artifact-io";
import { PrismaImageSearchAdmissionRepository } from "@/backend/repositories/image-search/prisma-image-search-admission-repository";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";
import { ImageSearchAdmissionReadiness } from "@/backend/services/image-search/image-search-admission-readiness";
import { ImageSearchCleanupWorker } from "@/backend/image-search/workers/cleanup";
import { ImageSearchReconciliationWorker } from "@/backend/image-search/workers/reconciliation";

const queries: string[] = [];
const roots: string[] = [];

afterEach(async () => {
  if (queries.length)
    await prisma.searchImageQuery.deleteMany({
      where: { id: { in: queries.splice(0) } },
    });
  await prisma.imageSearchOperationalEvidence.deleteMany({
    where: { component: { in: ["CLEANUP", "RECONCILIATION"] } },
  });
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe.sequential("image-search hard deletion lifecycle", () => {
  it("denies content immediately and verifies physical absence independently", async () => {
    const now = new Date("2026-08-06T06:00:00.000Z");
    const admitted = await new PrismaImageSearchAdmissionRepository().admit({
      actor: {
        kind: "VISITOR",
        browserDigest: Buffer.alloc(32, 1),
        sourceIpDigest: Buffer.alloc(32, 2),
        capability: Buffer.alloc(32, 3).toString("base64url"),
        capabilityHmacKey: Buffer.alloc(32, 4),
        capabilityKeyVersion: 1,
      },
      metadata: {
        extension: "png",
        mediaType: "image/png",
        bytes: 8,
        interpreterClass: "DETERMINISTIC_INTERNAL",
        consent: null,
      },
      idempotencyDigest: Buffer.alloc(32, 5),
      bindingDigest: Buffer.alloc(32, 6),
      now,
    });
    if (admitted.kind !== "ADMITTED")
      throw new Error("fixture admission failed");
    queries.push(admitted.query.id);
    const root = await mkdtemp(join(tmpdir(), "image-search-cleanup-"));
    roots.push(root);
    const storage = new FilesystemPrivateSearchArtifactStorage({
      root,
      keyring: {
        activeKeyVersion: 1,
        keys: new Map([[1, Buffer.alloc(32, 7)]]),
      },
    });
    const artifactId = randomUUID();
    const source = Buffer.from("89504e470d0a1a0a", "hex");
    const stored = await storage.put({
      source: oneChunk(source),
      expectedBytes: source.byteLength,
      context: {
        queryId: admitted.query.id,
        artifactId,
        kind: "SOURCE_IMAGE",
      },
    });
    const repository = new PrismaImageSearchQueryRepository();
    await repository.attachSourceAndQueueScan({
      queryId: admitted.query.id,
      now,
      artifactId,
      adapter: "filesystem",
      stored,
    });
    const cancelledAt = new Date(now.getTime() + 1_000);
    await repository.makeContentInaccessible({
      queryId: admitted.query.id,
      now: cancelledAt,
      status: "CANCELLED",
    });
    const inaccessible = await prisma.searchStoredArtifact.findUnique({
      where: { id: artifactId },
      select: { status: true, contentInaccessibleAt: true, deleteAfter: true },
    });
    expect(inaccessible).toMatchObject({
      status: "DELETE_PENDING",
      contentInaccessibleAt: cancelledAt,
      deleteAfter: cancelledAt,
    });

    const readiness = new ImageSearchAdmissionReadiness({ production: false });
    await expect(readiness.assertAdmissionReady(cancelledAt)).rejects.toThrow();
    await new ImageSearchReconciliationWorker().runOnce(cancelledAt);
    await new ImageSearchCleanupWorker({
      storage,
      owner: `cleanup-${randomUUID()}`,
    }).runOnce(cancelledAt);
    await expect(
      readiness.assertAdmissionReady(cancelledAt),
    ).resolves.toBeUndefined();
    const scrubbed = await prisma.searchStoredArtifact.findUnique({
      where: { id: artifactId },
      select: {
        status: true,
        storageLocator: true,
        encryptionKeyVersion: true,
        authenticationTag: true,
        deletedAt: true,
      },
    });
    expect(scrubbed).toMatchObject({
      status: "DELETED",
      storageLocator: null,
      encryptionKeyVersion: null,
      authenticationTag: null,
      deletedAt: cancelledAt,
    });
    expect(
      await prisma.searchImageQuery.findUnique({
        where: { id: admitted.query.id },
        select: { status: true, deletedAt: true },
      }),
    ).toEqual({ status: "DELETED", deletedAt: cancelledAt });
  });
});
