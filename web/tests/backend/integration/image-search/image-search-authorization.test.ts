import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/backend/database/prisma";
import { PrismaImageSearchAdmissionRepository } from "@/backend/repositories/image-search/prisma-image-search-admission-repository";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";

const queryIds: string[] = [];

afterEach(async () => {
  if (queryIds.length)
    await prisma.searchImageQuery.deleteMany({
      where: { id: { in: queryIds.splice(0) } },
    });
});

describe.sequential("image-search authorization", () => {
  it("uses the query capability—not the rate cookie—as visitor authority", async () => {
    const now = new Date();
    const capability = Buffer.alloc(32, 31).toString("base64url");
    const capabilityKey = Buffer.alloc(32, 32);
    const admitted = await new PrismaImageSearchAdmissionRepository().admit({
      actor: {
        kind: "VISITOR",
        browserDigest: Buffer.alloc(32, 33),
        sourceIpDigest: Buffer.alloc(32, 34),
        capability,
        capabilityHmacKey: capabilityKey,
        capabilityKeyVersion: 1,
      },
      metadata: {
        extension: "jpeg",
        mediaType: "image/jpeg",
        bytes: 4,
        interpreterClass: "DETERMINISTIC_INTERNAL",
        consent: null,
      },
      idempotencyDigest: Buffer.alloc(32, 35),
      bindingDigest: Buffer.alloc(32, 36),
      now,
    });
    if (admitted.kind !== "ADMITTED")
      throw new Error("fixture admission failed");
    queryIds.push(admitted.query.id);
    const repository = new PrismaImageSearchQueryRepository();
    await expect(
      repository.authorize({
        queryId: admitted.query.id,
        actor: { kind: "VISITOR", browserSubjectDigest: Buffer.alloc(32, 99) },
        visitorCapability: capability,
        capabilityHmacKey: capabilityKey,
        now,
      }),
    ).resolves.toMatchObject({ id: admitted.query.id, actorClass: "VISITOR" });
    await expect(
      repository.authorize({
        queryId: admitted.query.id,
        actor: { kind: "VISITOR", browserSubjectDigest: Buffer.alloc(32, 33) },
        visitorCapability: Buffer.alloc(32, 98).toString("base64url"),
        capabilityHmacKey: capabilityKey,
        now,
      }),
    ).rejects.toMatchObject({ code: "IMAGE_SEARCH_NOT_FOUND" });
    await expect(
      repository.authorize({
        queryId: admitted.query.id,
        actor: {
          kind: "AUTHENTICATED",
          accountId: "forged-account",
          sessionId: "forged-session",
        },
        visitorCapability: null,
        capabilityHmacKey: capabilityKey,
        now,
      }),
    ).rejects.toMatchObject({ code: "IMAGE_SEARCH_NOT_FOUND" });
  });

  it("turns an overdue authorized query inaccessible before returning expiry", async () => {
    const now = new Date();
    const capability = Buffer.alloc(32, 41).toString("base64url");
    const capabilityKey = Buffer.alloc(32, 42);
    const admitted = await new PrismaImageSearchAdmissionRepository().admit({
      actor: {
        kind: "VISITOR",
        browserDigest: Buffer.alloc(32, 43),
        sourceIpDigest: Buffer.alloc(32, 44),
        capability,
        capabilityHmacKey: capabilityKey,
        capabilityKeyVersion: 1,
      },
      metadata: {
        extension: "png",
        mediaType: "image/png",
        bytes: 8,
        interpreterClass: "DETERMINISTIC_INTERNAL",
        consent: null,
      },
      idempotencyDigest: Buffer.alloc(32, 45),
      bindingDigest: Buffer.alloc(32, 46),
      now,
    });
    if (admitted.kind !== "ADMITTED")
      throw new Error("fixture admission failed");
    queryIds.push(admitted.query.id);
    const repository = new PrismaImageSearchQueryRepository();
    await expect(
      repository.authorize({
        queryId: admitted.query.id,
        actor: { kind: "VISITOR", browserSubjectDigest: Buffer.alloc(32, 43) },
        visitorCapability: capability,
        capabilityHmacKey: capabilityKey,
        now: admitted.query.expiresAt,
      }),
    ).rejects.toMatchObject({ code: "QUERY_EXPIRED" });
    expect(
      await prisma.searchImageQuery.findUnique({
        where: { id: admitted.query.id },
        select: { status: true, contentInaccessibleAt: true },
      }),
    ).toEqual({
      status: "EXPIRED",
      contentInaccessibleAt: admitted.query.expiresAt,
    });
  });
});
