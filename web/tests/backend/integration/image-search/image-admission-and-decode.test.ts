import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/backend/database/prisma";
import { FilesystemPrivateSearchArtifactStorage } from "@/backend/image-search/storage/filesystem";
import { PrismaImageSearchAdmissionRepository } from "@/backend/repositories/image-search/prisma-image-search-admission-repository";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";
import { ReceiveImageSearchContentService } from "@/backend/services/image-search/receive-image-search-content";

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

async function fixture(seed: number, declaredBytes: number) {
  const now = new Date();
  const capability = Buffer.alloc(32, seed).toString("base64url");
  const capabilityKey = Buffer.alloc(32, seed + 1);
  const browserDigest = Buffer.alloc(32, seed + 2);
  const admitted = await new PrismaImageSearchAdmissionRepository().admit({
    actor: {
      kind: "VISITOR",
      browserDigest,
      sourceIpDigest: Buffer.alloc(32, seed + 3),
      capability,
      capabilityHmacKey: capabilityKey,
      capabilityKeyVersion: 1,
    },
    metadata: {
      extension: "png",
      mediaType: "image/png",
      bytes: declaredBytes,
      interpreterClass: "DETERMINISTIC_INTERNAL",
      consent: null,
    },
    idempotencyDigest: Buffer.alloc(32, seed + 4),
    bindingDigest: Buffer.alloc(32, seed + 5),
    now,
  });
  if (admitted.kind !== "ADMITTED") throw new Error("fixture admission failed");
  queryIds.push(admitted.query.id);
  const root = await mkdtemp(join(tmpdir(), "image-search-receive-"));
  roots.push(root);
  const storage = new FilesystemPrivateSearchArtifactStorage({
    root,
    keyring: {
      activeKeyVersion: 1,
      keys: new Map([[1, Buffer.alloc(32, seed + 6)]]),
    },
  });
  return {
    now,
    capability,
    capabilityKey,
    browserDigest,
    queryId: admitted.query.id,
    service: new ReceiveImageSearchContentService({
      repository: new PrismaImageSearchQueryRepository(),
      storage: { adapterName: "filesystem", storage },
      capabilityHmacKey: capabilityKey,
      now: () => now,
    }),
  };
}

async function* chunks(...values: Uint8Array[]) {
  for (const value of values) yield value;
}

describe.sequential("image-search raw admission boundary", () => {
  it("requires exact reserved content headers before reading bytes", async () => {
    const current = await fixture(51, 8);
    await expect(
      current.service.execute({
        queryId: current.queryId,
        actor: { kind: "VISITOR", browserSubjectDigest: current.browserDigest },
        visitorCapability: current.capability,
        contentType: "image/jpeg",
        contentLength: 8,
        source: chunks(Buffer.from("89504e470d0a1a0a", "hex")),
      }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    expect(
      await prisma.searchStoredArtifact.count({
        where: { queryId: current.queryId },
      }),
    ).toBe(0);
  });

  it("rejects split leading-signature disagreement without attaching an artifact", async () => {
    const current = await fixture(61, 8);
    await expect(
      current.service.execute({
        queryId: current.queryId,
        actor: { kind: "VISITOR", browserSubjectDigest: current.browserDigest },
        visitorCapability: current.capability,
        contentType: "image/png",
        contentLength: 8,
        source: chunks(Buffer.from("not"), Buffer.from("-a-pn")),
      }),
    ).rejects.toMatchObject({ status: 415, code: "UNSUPPORTED_MEDIA_TYPE" });
    expect(
      await prisma.searchStoredArtifact.count({
        where: { queryId: current.queryId },
      }),
    ).toBe(0);
  });

  it("stores exact raw bytes encrypted and queues scanning idempotently", async () => {
    const current = await fixture(71, 8);
    const source = Buffer.from("89504e470d0a1a0a", "hex");
    const input = {
      queryId: current.queryId,
      actor: {
        kind: "VISITOR" as const,
        browserSubjectDigest: current.browserDigest,
      },
      visitorCapability: current.capability,
      contentType: "image/png",
      contentLength: source.byteLength,
      source: chunks(source.subarray(0, 3), source.subarray(3)),
    };
    await expect(current.service.execute(input)).resolves.toEqual({
      replay: false,
    });
    await expect(
      current.service.execute({ ...input, source: chunks(source) }),
    ).resolves.toEqual({ replay: true });
    expect(
      await prisma.searchImageQuery.findUnique({
        where: { id: current.queryId },
        select: { status: true, actualBytes: true },
      }),
    ).toEqual({ status: "SCAN_QUEUED", actualBytes: 8 });
    expect(
      await prisma.searchStoredArtifact.findFirst({
        where: { queryId: current.queryId },
        select: { kind: true, status: true, storageLocator: true },
      }),
    ).toMatchObject({
      kind: "SOURCE_IMAGE",
      status: "QUARANTINED",
      storageLocator: expect.stringMatching(/^[a-f0-9-]{36}\.bin$/u),
    });
  });
});
