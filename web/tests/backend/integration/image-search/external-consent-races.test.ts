import { createHmac, randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/backend/database/prisma";
import { PrismaImageSearchQueryRepository } from "@/backend/repositories/image-search/prisma-image-search-query-repository";
import { PrismaImageSearchWorkRepository } from "@/backend/repositories/image-search/prisma-image-search-work-repository";
import { PrismaSearchConsentRepository } from "@/backend/repositories/image-search/prisma-search-consent-repository";
import { UpdateImageSearchConsentService } from "@/backend/services/image-search/update-image-search-consent";
import {
  IMAGE_SEARCH_CONSENT_TEXT_VERSION,
  IMAGE_SEARCH_NOTICE_VERSION,
  IMAGE_SEARCH_OPENAI_MODEL,
  IMAGE_SEARCH_PURPOSE_VERSION,
  IMAGE_SEARCH_RETENTION_DISCLOSURE_VERSION,
} from "@/shared/contracts/jobs/image-search";

const queryIds: string[] = [];

afterEach(async () => {
  if (queryIds.length)
    await prisma.searchImageQuery.deleteMany({
      where: { id: { in: queryIds.splice(0) } },
    });
});

const grant = {
  provider: "openai" as const,
  model: IMAGE_SEARCH_OPENAI_MODEL,
  purposeVersion: IMAGE_SEARCH_PURPOSE_VERSION,
  noticeVersion: IMAGE_SEARCH_NOTICE_VERSION,
  consentTextVersion: IMAGE_SEARCH_CONSENT_TEXT_VERSION,
  retentionDisclosureVersion: IMAGE_SEARCH_RETENTION_DISCLOSURE_VERSION,
};

describe.sequential("external image-search consent races", () => {
  it("replays an exact decision once and lets a later revocation prevent dispatch", async () => {
    const now = new Date();
    const queryId = randomUUID();
    const ocrAttemptId = randomUUID();
    const textArtifactId = randomUUID();
    const capability = Buffer.alloc(32, 91).toString("base64url");
    const capabilityKey = Buffer.alloc(32, 92);
    const browserDigest = Buffer.alloc(32, 93);
    const deleteBy = new Date(now.getTime() + 15 * 60_000);
    await prisma.searchImageQuery.create({
      data: {
        id: queryId,
        actorClass: "VISITOR",
        visitorSubjectDigest: browserDigest,
        visitorCapabilityDigest: createHmac("sha256", capabilityKey)
          .update(`image-search-capability-v1:${queryId}:${capability}`, "utf8")
          .digest(),
        capabilityKeyVersion: 1,
        status: "AWAITING_CONSENT",
        interpreterClass: "EXTERNAL_OPENAI",
        declaredExtension: "png",
        declaredMediaType: "image/png",
        declaredBytes: 8,
        idempotencyDigest: Buffer.alloc(32, 94),
        createBindingDigest: Buffer.alloc(32, 95),
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
        id: textArtifactId,
        queryId,
        kind: "OCR_TEXT",
        status: "AVAILABLE",
        storageAdapter: "fixture",
        storageLocator: `${randomUUID()}.bin`,
        encryptionKeyVersion: 1,
        encryptionIv: Buffer.alloc(12, 96),
        authenticationTag: Buffer.alloc(16, 97),
        plaintextBytes: 10,
        ciphertextBytes: 10,
        plaintextSha256: Buffer.alloc(32, 98),
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
        engineVersion: "1.1.0",
        modelName: "PP-OCRv6-medium",
        modelSha256: Buffer.alloc(32, 99),
        runtimeName: "onnxruntime",
        runtimeVersion: "1.27.0",
        confidencePolicyVersion: "ocr-confidence-v1",
        inputUnitCount: 1,
        succeededUnitCount: 1,
        outputLineCount: 1,
        outputUtf8Bytes: 10,
        completedAt: now,
      },
      select: { id: true },
    });
    const repository = new PrismaImageSearchQueryRepository();
    const service = new UpdateImageSearchConsentService({
      queries: repository,
      consents: new PrismaSearchConsentRepository(),
      capabilityHmacKey: capabilityKey,
      now: () => now,
    });
    const actor = {
      kind: "VISITOR" as const,
      browserSubjectDigest: browserDigest,
    };
    const grantInput = {
      queryId,
      actor,
      visitorCapability: capability,
      idempotencyKey: "consent-grant-0001",
      body: { action: "GRANTED", grant },
    };
    await expect(service.execute(grantInput)).resolves.toMatchObject({
      action: "GRANTED",
      state: "INTERPRET_QUEUED",
    });
    await expect(service.execute(grantInput)).resolves.toMatchObject({
      action: "GRANTED",
      state: "INTERPRET_QUEUED",
    });
    expect(
      await prisma.searchProcessingConsent.count({ where: { queryId } }),
    ).toBe(1);
    await expect(
      service.execute({
        ...grantInput,
        body: { action: "REVOKED", grant: null },
      }),
    ).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_KEY_REUSED" });
    await expect(
      service.execute({
        ...grantInput,
        idempotencyKey: "consent-revoke-0001",
        body: { action: "REVOKED", grant: null },
      }),
    ).resolves.toMatchObject({ action: "REVOKED", state: "FALLBACK_READY" });
    expect(await repository.currentStatus(queryId)).toMatchObject({
      status: "FALLBACK_READY",
      consentEvents: [{ action: "REVOKED" }],
    });
    expect(
      await prisma.searchIntentAttempt.findFirst({
        where: { queryId },
        select: { status: true, leaseOwner: true },
      }),
    ).toEqual({ status: "CANCELLED", leaseOwner: null });
    expect(
      await new PrismaImageSearchWorkRepository().claimStage({
        stage: "INTERPRET",
        owner: `dispatch-check:${randomUUID()}`,
        now,
        leaseMs: 30_000,
        limit: 1,
      }),
    ).toEqual([]);
  });
});
