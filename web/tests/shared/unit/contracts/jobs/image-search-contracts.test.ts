import { describe, expect, it } from "vitest";

import {
  consumeImageSearchResultRequestSchema,
  createImageSearchRequestSchema,
  createImageSearchResponseSchema,
  imageSearchStatusResponseSchema,
} from "@/shared/contracts/jobs/image-search";

describe("image-search public contracts", () => {
  it("requires matching image metadata and exact external consent", () => {
    expect(
      createImageSearchRequestSchema.safeParse({
        extension: "png",
        mediaType: "image/jpeg",
        bytes: 100,
        interpreterClass: "DETERMINISTIC_INTERNAL",
        consent: null,
      }).success,
    ).toBe(false);
    expect(
      createImageSearchRequestSchema.safeParse({
        extension: "png",
        mediaType: "image/png",
        bytes: 100,
        interpreterClass: "DETERMINISTIC_INTERNAL",
        consent: null,
      }).success,
    ).toBe(false);
    expect(
      createImageSearchRequestSchema.safeParse({
        extension: "png",
        mediaType: "image/png",
        bytes: 100,
        interpreterClass: "EXTERNAL_OPENAI",
        consent: null,
      }).success,
    ).toBe(false);
  });

  it("keeps status content-free and rejects unknown ownership fields", () => {
    const status = {
      queryId: "query-123456789",
      state: "OCR_PROCESSING",
      stage: "OCR",
      availableActions: ["CANCEL"],
      admittedAt: "2026-08-06T00:00:00.000Z",
      expiresAt: "2026-08-06T00:15:00.000Z",
      retryAt: null,
      failureCode: null,
    };
    expect(imageSearchStatusResponseSchema.parse(status)).toEqual(status);
    for (const failureCode of [
      "OCR_NO_TEXT",
      "OCR_PARTIAL",
      "OCR_DEADLINE_EXCEEDED",
    ] as const) {
      expect(
        imageSearchStatusResponseSchema.parse({ ...status, failureCode })
          .failureCode,
      ).toBe(failureCode);
    }
    expect(
      imageSearchStatusResponseSchema.safeParse({
        ...status,
        ocrText: "must never appear",
      }).success,
    ).toBe(false);
    expect(
      consumeImageSearchResultRequestSchema.safeParse({
        accountId: "attacker-selected",
        currentCriteria: {},
      }).success,
    ).toBe(false);
  });

  it("returns a visitor capability only at the reservation boundary", () => {
    const response = createImageSearchResponseSchema.parse({
      queryId: "query-123456789",
      actorClass: "VISITOR",
      capability: "a".repeat(43),
      status: "AWAITING_CONTENT",
      admittedAt: "2026-08-06T00:00:00.000Z",
      expiresAt: "2026-08-06T00:15:00.000Z",
      upload: {
        method: "PUT",
        path: "/api/jobs/image-searches/query-123456789/content",
        mediaType: "image/png",
        bytes: 100,
      },
    });
    expect(JSON.stringify(response)).not.toContain("browserSubject");
  });
});
