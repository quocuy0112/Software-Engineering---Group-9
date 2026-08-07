import { createHmac, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/backend/database/prisma";
import { DeterministicSearchIntentInterpreter } from "@/backend/image-search/interpretation/deterministic";
import { SearchIntentSelectionPolicy } from "@/backend/image-search/interpretation/selection-policy";
import { oneChunk } from "@/backend/image-search/storage/artifact-io";
import { FilesystemPrivateSearchArtifactStorage } from "@/backend/image-search/storage/filesystem";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";
import { ConsumeImageSearchResultService } from "@/backend/services/image-search/consume-image-search-result";
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

const manualCriteria = {
  q: "Existing manual query",
  location: "",
  employmentType: [] as never[],
  experienceLevel: [] as never[],
  workArrangement: [] as never[],
  skills: ["React"],
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: "VND",
  salaryPeriod: "MONTH" as const,
  postedWithinDays: null,
  sort: "RELEVANCE" as const,
};

describe.sequential("image-search one-time result consumption", () => {
  it("preserves current scalar criteria, deduplicates sets, and retires the result", async () => {
    const now = new Date();
    const queryId = randomUUID();
    queryIds.push(queryId);
    const capability = Buffer.alloc(32, 21).toString("base64url");
    const capabilityKey = Buffer.alloc(32, 22);
    const browserDigest = Buffer.alloc(32, 23);
    const capabilityDigest = createHmac("sha256", capabilityKey)
      .update(`image-search-capability-v1:${queryId}:${capability}`, "utf8")
      .digest();
    const policy = new SearchIntentSelectionPolicy();
    const validator = new ValidateSearchIntentService({
      interpreter: new DeterministicSearchIntentInterpreter(),
      selectionPolicy: policy,
    });
    const intent = await validator.execute({
      text: "Position: Senior TypeScript Engineer\nSkills: React TypeScript\nRemote",
      language: "EN",
      deadline: new Date(now.getTime() + 5_000),
      signal: new AbortController().signal,
    });
    const payload = Buffer.from(JSON.stringify(intent), "utf8");
    const root = await mkdtemp(join(tmpdir(), "image-search-consume-"));
    roots.push(root);
    const storage = new FilesystemPrivateSearchArtifactStorage({
      root,
      keyring: {
        activeKeyVersion: 1,
        keys: new Map([[1, Buffer.alloc(32, 24)]]),
      },
    });
    const artifactId = randomUUID();
    const stored = await storage.put({
      source: oneChunk(payload),
      expectedBytes: payload.byteLength,
      context: { queryId, artifactId, kind: "VALIDATED_INTENT" },
    });
    await prisma.searchImageQuery.create({
      data: {
        id: queryId,
        actorClass: "VISITOR",
        visitorSubjectDigest: browserDigest,
        visitorCapabilityDigest: capabilityDigest,
        capabilityKeyVersion: 1,
        status: "RESULT_READY",
        interpreterClass: "DETERMINISTIC_INTERNAL",
        declaredExtension: "png",
        declaredMediaType: "image/png",
        declaredBytes: 8,
        idempotencyDigest: Buffer.alloc(32, 25),
        createBindingDigest: Buffer.alloc(32, 26),
        resultKind: "VALIDATED_INTENT",
        admittedAt: now,
        resultReadyAt: now,
        expiresAt: new Date(now.getTime() + 15 * 60_000),
        deleteBy: new Date(now.getTime() + 15 * 60_000),
        createdAt: now,
        artifacts: {
          create: {
            id: artifactId,
            kind: "VALIDATED_INTENT",
            status: "AVAILABLE",
            storageAdapter: "filesystem",
            storageLocator: String(stored.locator),
            encryptionKeyVersion: stored.encryptionKeyVersion,
            encryptionIv: Buffer.from(stored.encryptionIv),
            authenticationTag: Buffer.from(stored.authenticationTag),
            plaintextBytes: stored.plaintextBytes,
            ciphertextBytes: stored.ciphertextBytes,
            plaintextSha256: Buffer.from(stored.plaintextSha256),
            availableAt: now,
            deleteBy: new Date(now.getTime() + 15 * 60_000),
          },
        },
      },
      select: { id: true },
    });
    const service = new ConsumeImageSearchResultService({
      repository: new PrismaImageSearchQueryRepository(),
      storage: { adapterName: "filesystem", storage },
      capabilityHmacKey: capabilityKey,
      selectionPolicy: policy,
      now: () => now,
    });
    const result = await service.execute({
      queryId,
      actor: { kind: "VISITOR", browserSubjectDigest: browserDigest },
      visitorCapability: capability,
      body: { currentCriteria: manualCriteria },
    });
    expect(result.kind).toBe("VALIDATED_INTENT");
    if (result.kind !== "VALIDATED_INTENT")
      throw new Error("unexpected result");
    expect(
      result.intent.proposals.find((proposal) => proposal.field === "q"),
    ).toMatchObject({
      selected: false,
      selectionReason: "MANUAL_VALUE_CONFLICT",
    });
    expect(
      result.intent.proposals.some(
        (proposal) =>
          proposal.field === "skills" &&
          proposal.stringValues.includes("React"),
      ),
    ).toBe(false);
    expect(
      result.intent.proposals.find(
        (proposal) =>
          proposal.field === "skills" &&
          proposal.stringValues.includes("TypeScript"),
      ),
    ).toMatchObject({ selected: true });
    expect(
      await prisma.searchImageQuery.findUnique({
        where: { id: queryId },
        select: { status: true, contentInaccessibleAt: true },
      }),
    ).toMatchObject({ status: "CONSUMED", contentInaccessibleAt: now });
    expect(
      await prisma.searchStoredArtifact.findUnique({
        where: { id: artifactId },
        select: { status: true, deleteAfter: true },
      }),
    ).toEqual({ status: "DELETE_PENDING", deleteAfter: now });
    await expect(
      service.execute({
        queryId,
        actor: { kind: "VISITOR", browserSubjectDigest: browserDigest },
        visitorCapability: capability,
        body: { currentCriteria: manualCriteria },
      }),
    ).rejects.toMatchObject({ status: 409, code: "RESULT_ALREADY_CONSUMED" });
  });
});
