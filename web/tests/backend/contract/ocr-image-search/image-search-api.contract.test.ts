import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { noStoreHeaders } from "@/backend/services/image-search/image-search-errors";
import {
  consumeImageSearchResultRequestSchema,
  createImageSearchRequestSchema,
  imageSearchResultSchema,
  imageSearchStatusResponseSchema,
  searchConsentRequestSchema,
} from "@/shared/contracts/jobs/image-search";

const featureRoot = resolve(process.cwd(), "../spec-kit/specs/005-ocr-parsing");
const openapi = readFileSync(
  resolve(featureRoot, "contracts/openapi.yaml"),
  "utf8",
);

describe("image-search OpenAPI and runtime-contract parity", () => {
  it("documents every implemented no-store operation and raw-stream boundary", () => {
    for (const operation of [
      "createImageSearch",
      "getImageSearchStatus",
      "cancelImageSearch",
      "uploadImageSearchContent",
      "changeImageSearchConsent",
      "consumeImageSearchResult",
    ])
      expect(openapi).toContain(`operationId: ${operation}`);
    expect(openapi).toContain("image/png:");
    expect(openapi).toContain("image/jpeg:");
    expect(openapi).toContain("Content-Length");
    expect(openapi).toContain("Idempotency-Key");
    expect(openapi).toContain("X-Image-Search-Capability");
    expect(openapi).toContain("no-store, max-age=0");
    expect(noStoreHeaders).toMatchObject({
      "cache-control": "no-store, max-age=0",
    });
  });

  it("keeps every public object strict and excludes ownership inputs", () => {
    for (const schema of [
      createImageSearchRequestSchema,
      imageSearchStatusResponseSchema,
      consumeImageSearchResultRequestSchema,
      searchConsentRequestSchema,
      imageSearchResultSchema,
    ]) {
      expect(
        schema.safeParse({ accountId: "forged", userId: "forged" }).success,
      ).toBe(false);
    }
    expect(
      createImageSearchRequestSchema.safeParse({
        extension: "png",
        mediaType: "image/png",
        bytes: 8,
        interpreterClass: "DETERMINISTIC_INTERNAL",
        consent: null,
        accountId: "forged",
      }).success,
    ).toBe(false);
  });

  it("keeps route handlers thin and delegates all state changes", () => {
    for (const route of [
      "src/app/api/jobs/image-searches/route.ts",
      "src/app/api/jobs/image-searches/[queryId]/content/route.ts",
      "src/app/api/jobs/image-searches/[queryId]/route.ts",
      "src/app/api/jobs/image-searches/[queryId]/result/route.ts",
      "src/app/api/jobs/image-searches/[queryId]/consent/route.ts",
    ]) {
      const source = readFileSync(resolve(process.cwd(), route), "utf8");
      expect(source, route).toContain("enforceImageSearchRequestBoundary");
      expect(source, route).toContain("createImageSearchRouteResources");
      expect(source, route).toContain("noStoreHeaders");
      expect(source, route).not.toContain("prisma.");
    }
  });
});
