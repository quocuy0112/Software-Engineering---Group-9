import { createHmac, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/backend/database/prisma";
import { SearchIntentSelectionPolicy } from "@/backend/image-search/interpretation/selection-policy";
import { oneChunk } from "@/backend/image-search/storage/artifact-io";
import { FilesystemPrivateSearchArtifactStorage } from "@/backend/image-search/storage/filesystem";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";
import { ConsumeImageSearchResultService } from "@/backend/services/image-search/consume-image-search-result";
import { CreateImageSearchFallbackService } from "@/backend/services/image-search/create-image-search-fallback";

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

describe.sequential("image-search interpretation fallback", () => {
  it("delivers OCR text once and retires it when interpretation is unavailable", async () => {
    const now = new Date();
    const queryId = randomUUID();
    const artifactId = randomUUID();
    const ocrAttemptId = randomUUID();
    const intentAttemptId = randomUUID();
    const capability = Buffer.alloc(32, 81).toString("base64url");
    const capabilityKey = Buffer.alloc(32, 82);
    const browserDigest = Buffer.alloc(32, 83);
    const owner = `intent-fixture:${randomUUID()}`;
    const deleteBy = new Date(now.getTime() + 15 * 60_000);
    const payload = Buffer.from(
      JSON.stringify({
        schemaVersion: "search-ocr-text-v1",
        text: "Senior TypeScript engineer, remote",
        language: "EN",
        warnings: [],
      }),
      "utf8",
    );
    const root = await mkdtemp(join(tmpdir(), "image-search-fallback-"));
    roots.push(root);
    const storage = new FilesystemPrivateSearchArtifactStorage({
      root,
      keyring: {
        activeKeyVersion: 1,
        keys: new Map([[1, Buffer.alloc(32, 84)]]),
      },
    });
    const stored = await storage.put({
      source: oneChunk(payload),
      expectedBytes: payload.byteLength,
      context: { queryId, artifactId, kind: "OCR_TEXT" },
    });
    await prisma.searchImageQuery.create({
      data: {
        id: queryId,
        actorClass: "VISITOR",
        visitorSubjectDigest: browserDigest,
        visitorCapabilityDigest: createHmac("sha256", capabilityKey)
          .update(`image-search-capability-v1:${queryId}:${capability}`, "utf8")
          .digest(),
        capabilityKeyVersion: 1,
        status: "INTERPRETING",
        interpreterClass: "DETERMINISTIC_INTERNAL",
        declaredExtension: "png",
        declaredMediaType: "image/png",
        declaredBytes: 8,
        idempotencyDigest: Buffer.alloc(32, 85),
        createBindingDigest: Buffer.alloc(32, 86),
        admittedAt: now,
        expiresAt: deleteBy,
        deleteBy,
        createdAt: now,
      },
      select: { id: true },
    });
    queryIds.push(queryId);
    await prisma.searchStoredArtifact.create({
      data: {
        id: artifactId,
        queryId,
        kind: "OCR_TEXT",
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
        deleteBy,
      },
      select: { id: true },
    });
    await prisma.ocrProcessingAttempt.create({
      data: {
        id: ocrAttemptId,
        purpose: "JOB_IMAGE_SEARCH",
        searchQueryId: queryId,
        status: "SUCCEEDED",
        engineName: "paddleocr-onnx",
        engineVersion: "1.0.0",
        modelName: "PP-OCRv6-medium",
        modelSha256: Buffer.alloc(32, 87),
        runtimeName: "onnxruntime",
        runtimeVersion: "1.27.0",
        confidencePolicyVersion: "ocr-confidence-v1",
        inputUnitCount: 1,
        succeededUnitCount: 1,
        outputLineCount: 1,
        outputUtf8Bytes: payload.byteLength,
        completedAt: now,
      },
      select: { id: true },
    });
    await prisma.searchIntentAttempt.create({
      data: {
        id: intentAttemptId,
        queryId,
        ocrAttemptId,
        ocrTextArtifactId: artifactId,
        attemptNumber: 1,
        status: "PROCESSING",
        interpreterClass: "DETERMINISTIC_INTERNAL",
        provider: "smarthire",
        model: "deterministic-v1",
        purposeVersion: "job-image-search-purpose-v1",
        inputVersion: "search-ocr-text-v1",
        instructionVersion: "job-search-intent-v1",
        schemaVersion: "job-search-intent-v1",
        selectionPolicyVersion: "search-intent-selection-v1",
        leaseOwner: owner,
        leaseExpiresAt: new Date(now.getTime() + 30_000),
        startedAt: now,
      },
      select: { id: true },
    });
    await new CreateImageSearchFallbackService().execute({
      queryId,
      intentAttemptId,
      now,
      failureCode: "INTERPRETER_UNAVAILABLE",
      leaseOwner: owner,
    });
    const consume = new ConsumeImageSearchResultService({
      repository: new PrismaImageSearchQueryRepository(),
      storage: { adapterName: "filesystem", storage },
      capabilityHmacKey: capabilityKey,
      selectionPolicy: new SearchIntentSelectionPolicy(),
      now: () => now,
    });
    const result = await consume.execute({
      queryId,
      actor: { kind: "VISITOR", browserSubjectDigest: browserDigest },
      visitorCapability: capability,
      body: {
        currentCriteria: {
          q: "manual",
          location: "",
          employmentType: [],
          experienceLevel: [],
          workArrangement: [],
          skills: [],
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: "VND",
          salaryPeriod: "MONTH",
          postedWithinDays: null,
          sort: "RELEVANCE",
        },
      },
    });
    expect(result).toMatchObject({
      kind: "OCR_TEXT_FALLBACK",
      text: "Senior TypeScript engineer, remote",
      warnings: ["INTERPRETER_UNAVAILABLE"],
    });
    expect(
      await prisma.searchStoredArtifact.findUnique({
        where: { id: artifactId },
        select: {
          status: true,
          contentInaccessibleAt: true,
          deleteAfter: true,
        },
      }),
    ).toEqual({
      status: "DELETE_PENDING",
      contentInaccessibleAt: now,
      deleteAfter: now,
    });
    await expect(
      consume.execute({
        queryId,
        actor: { kind: "VISITOR", browserSubjectDigest: browserDigest },
        visitorCapability: capability,
        body: {
          currentCriteria: {
            q: "",
            location: "",
            employmentType: [],
            experienceLevel: [],
            workArrangement: [],
            skills: [],
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: "VND",
            salaryPeriod: "MONTH",
            postedWithinDays: null,
            sort: "RELEVANCE",
          },
        },
      }),
    ).rejects.toMatchObject({ code: "RESULT_ALREADY_CONSUMED" });
  });
});
