import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CV_PROCESSING_NOTICES,
  createCvImportRequestSchema,
  cvContentHeadersSchema,
  cvImportListSchema,
  cvImportResourceSchema,
  cvUploadReservationSchema,
} from "@/shared/contracts/cv-import/upload";

const createRequest = {
  displayFilename: "synthetic-candidate.pdf",
  declaredMediaType: "application/pdf",
  declaredBytes: 5_000_000,
  parserClass: "DETERMINISTIC_INTERNAL",
} as const;

describe("CV upload HTTP contract", () => {
  it("accepts only strict PDF/DOC/DOCX reservation metadata from 1 to 5,000,000 bytes", () => {
    expect(createCvImportRequestSchema.parse(createRequest)).toEqual(
      createRequest,
    );
    expect(
      createCvImportRequestSchema.parse({
        ...createRequest,
        displayFilename: "synthetic-candidate.doc",
        declaredMediaType: "application/msword",
      }),
    ).toMatchObject({
      displayFilename: "synthetic-candidate.doc",
      declaredMediaType: "application/msword",
    });
    expect(
      createCvImportRequestSchema.parse({
        ...createRequest,
        displayFilename: "synthetic-candidate.docx",
        declaredMediaType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toMatchObject({
      displayFilename: "synthetic-candidate.docx",
      declaredMediaType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(
      createCvImportRequestSchema.safeParse({
        ...createRequest,
        declaredBytes: 0,
      }).success,
    ).toBe(false);
    expect(
      createCvImportRequestSchema.safeParse({
        ...createRequest,
        declaredBytes: 5_000_001,
      }).success,
    ).toBe(false);
    for (const field of [
      "accountId",
      "ownerId",
      "storageLocator",
      "providerUrl",
    ]) {
      expect(
        createCvImportRequestSchema.safeParse({
          ...createRequest,
          [field]: "forged",
        }).success,
      ).toBe(false);
    }
  });

  it("requires exact content headers and a strict idempotency key", () => {
    expect(
      cvContentHeadersSchema.parse({
        contentType: "application/pdf",
        contentLength: "5000000",
        idempotencyKey: "fixture-key_1234567890",
      }),
    ).toMatchObject({ contentLength: 5_000_000 });
    expect(
      cvContentHeadersSchema.safeParse({
        contentType: "multipart/form-data",
        contentLength: "1",
        idempotencyKey: "fixture-key_1234567890",
      }).success,
    ).toBe(false);
  });

  it("projects a versioned privacy notice for every parser class", () => {
    expect(Object.keys(CV_PROCESSING_NOTICES).sort()).toEqual([
      "DETERMINISTIC_INTERNAL",
      "EXTERNAL_OPENAI",
    ]);
    for (const notice of Object.values(CV_PROCESSING_NOTICES)) {
      expect(notice.noticeVersion).toMatch(/^cv-processing[.]/u);
      expect(notice.noticeText.length).toBeGreaterThan(20);
    }
    expect(
      CV_PROCESSING_NOTICES.EXTERNAL_OPENAI.externalConsentRequiredFor,
    ).toEqual(["EXTERNAL_OPENAI"]);
    expect(
      CV_PROCESSING_NOTICES.DETERMINISTIC_INTERNAL.externalConsentRequiredFor,
    ).toEqual([]);
  });

  it("keeps reservation/list/status responses strict and content-safe", () => {
    expect(
      cvUploadReservationSchema.safeParse({
        uploadId: "upload_fixture_1234",
        status: "AWAITING_CONTENT",
        contentUrl: "/api/account/cv-imports/upload_fixture_1234/content",
        expiresAt: "2026-08-31T00:00:00.000Z",
        limits: {
          maximumBytes: 5_000_000,
          requiredContentType: "application/pdf",
          requiredContentLength: 100,
        },
        storageLocator: "forbidden",
      }).success,
    ).toBe(false);
    expect(
      cvImportListSchema.safeParse({
        items: [],
        limits: {
          maximumFileBytes: 5_000_000,
          maximumImports: 10,
          maximumStoredBytes: 52_428_800,
          uploadAttemptsPerRollingHour: 5,
        },
        processingNotice: CV_PROCESSING_NOTICES.DETERMINISTIC_INTERNAL,
      }).success,
    ).toBe(true);
    expect(
      cvImportResourceSchema.safeParse({ uploadId: "x", rawText: "forbidden" })
        .success,
    ).toBe(false);
  });

  it("keeps OpenAPI no-store, parser, idempotency, and conflict definitions aligned", async () => {
    const openapi = await readFile(
      resolve(
        process.cwd(),
        "../spec-kit/specs/004-cv-upload-parse-review/contracts/openapi.yaml",
      ),
      "utf8",
    );
    expect(openapi).toContain("operationId: createOwnCvImport");
    expect(openapi).toContain("operationId: uploadOwnCvImportContent");
    expect(openapi).toContain("operationId: getOwnCvImport");
    expect(openapi).toContain('$ref: "#/components/headers/NoStoreHeader"');
    expect(openapi).toContain("IDEMPOTENCY_KEY_REUSED");
    expect(openapi).not.toMatch(/ownerId|storageLocator/u);
  });
});
