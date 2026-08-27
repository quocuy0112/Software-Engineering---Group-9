import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { loadImageSearchConfiguration } from "@/backend/image-search/config";

const modelSha =
  "a8f8b2e10b1870bd35f1ec7a160399f5d4c6a6c6326c373abf01d7fdc9e38bba";

function localEnvironment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    APP_ENV: "local",
    OCR_ENGINE_ENABLED: "true",
    OCR_ENGINE_SOCKET_PATH: "/run/smarthire-ocr/ocr.sock",
    OCR_ENGINE_NAME: "paddleocr-onnx",
    OCR_ENGINE_VERSION: "1.1.0",
    OCR_MODEL_NAME: "PP-OCRv6-medium",
    OCR_MODEL_SHA256: modelSha,
    OCR_POLICY_VERSION: "ocr-confidence-v1",
    OCR_CV_UNIT_TIMEOUT_SECONDS: "20",
    CV_HYBRID_DEADLINE_SECONDS: "180",
    OCR_SEARCH_TIMEOUT_SECONDS: "10",
    IMAGE_SEARCH_WORKER_ENABLED: "true",
    IMAGE_SEARCH_CLEANUP_ENABLED: "true",
    IMAGE_SEARCH_STORAGE_ADAPTER: "filesystem",
    IMAGE_SEARCH_STORAGE_LOCAL_ROOT: resolve(
      process.cwd(),
      ".local/image-search-storage",
    ),
    IMAGE_SEARCH_ARTIFACT_ACTIVE_KEY_VERSION: "1",
    IMAGE_SEARCH_ARTIFACT_KEY_V1: Buffer.alloc(32, 1).toString("base64"),
    IMAGE_SEARCH_RATE_HMAC_KEY_V1: Buffer.alloc(32, 2).toString("base64"),
    IMAGE_SEARCH_CAPABILITY_HMAC_KEY_V1: Buffer.alloc(32, 3).toString("base64"),
    CV_ARTIFACT_KEY_V1: Buffer.alloc(32, 4).toString("base64"),
    IMAGE_SEARCH_INTERPRETER: "openai",
    IMAGE_SEARCH_OPENAI_ENABLED: "true",
    IMAGE_SEARCH_OPENAI_MODEL: "gpt-5.4-mini-2026-03-17",
    IMAGE_SEARCH_OPENAI_DPA_APPROVED: "false",
    IMAGE_SEARCH_OPENAI_PRIVACY_APPROVED: "false",
    IMAGE_SEARCH_OPENAI_CROSS_BORDER_APPROVED: "false",
    IMAGE_SEARCH_OPENAI_ZDR_APPROVED: "false",
    OPENAI_API_KEY: "shared-cv-and-image-search-test-key",
    IMAGE_SEARCH_SOURCE_MAX_BYTES: "5000000",
    IMAGE_SEARCH_MAX_DECODED_PIXELS: "20000000",
    IMAGE_SEARCH_VISITOR_LIMIT_PER_HOUR: "5",
    IMAGE_SEARCH_ACCOUNT_LIMIT_PER_HOUR: "15",
    IMAGE_SEARCH_RETENTION_MINUTES: "15",
    ...overrides,
  };
}

describe("Feature 005 configuration", () => {
  it("loads exact local deadlines, limits, provider pins, and separate keys", () => {
    const configuration = loadImageSearchConfiguration(localEnvironment());
    expect(configuration.ocr).toMatchObject({
      enabled: true,
      socketPath: "/run/smarthire-ocr/ocr.sock",
      engineName: "paddleocr-onnx",
      engineVersion: "1.1.0",
      modelName: "PP-OCRv6-medium",
      modelManifestSha256: modelSha,
      cvUnitTimeoutMs: 20_000,
      cvHybridDeadlineMs: 180_000,
      searchTimeoutMs: 10_000,
    });
    expect(configuration.storage.adapter).toBe("filesystem");
    expect(configuration.interpreter.class).toBe("EXTERNAL_OPENAI");
    expect(configuration.retentionMs).toBe(15 * 60_000);
  });

  it.each([
    ["OCR_ENGINE_SOCKET_PATH", "https://ocr.invalid"],
    ["OCR_MODEL_SHA256", "mutable"],
    ["OCR_CV_UNIT_TIMEOUT_SECONDS", "21"],
    ["CV_HYBRID_DEADLINE_SECONDS", "181"],
    ["OCR_SEARCH_TIMEOUT_SECONDS", "6"],
    ["IMAGE_SEARCH_RETENTION_MINUTES", "16"],
    ["IMAGE_SEARCH_STORAGE_LOCAL_ROOT", ".local/image-search-storage"],
  ])("fails closed for invalid fixed setting %s", (key, value) => {
    expect(() =>
      loadImageSearchConfiguration(localEnvironment({ [key]: value })),
    ).toThrow("IMAGE_SEARCH_CONFIGURATION_INVALID");
  });

  it("rejects key reuse and browser-public Feature 005 settings", () => {
    const shared = Buffer.alloc(32, 1).toString("base64");
    expect(() =>
      loadImageSearchConfiguration(
        localEnvironment({ IMAGE_SEARCH_RATE_HMAC_KEY_V1: shared }),
      ),
    ).toThrow("IMAGE_SEARCH_KEY_SEPARATION_REQUIRED");
    expect(() =>
      loadImageSearchConfiguration(
        localEnvironment({ NEXT_PUBLIC_OCR_MODEL_SHA256: modelSha }),
      ),
    ).toThrow("IMAGE_SEARCH_PUBLIC_CONFIGURATION_FORBIDDEN");
  });

  it("loads the server-only adaptive tiling flags and validates their allowlist", () => {
    const configuration = loadImageSearchConfiguration(
      localEnvironment({
        OCR_SEARCH_ADAPTIVE_TILING_ENABLED: "true",
        OCR_SEARCH_TILE_OVERLAP_PERCENT: "20",
        OCR_SEARCH_TILE_BATCH_SIZE: "4",
        OCR_SEARCH_MAX_TILES: "3",
        OCR_SEARCH_STRATEGY_VERSION: "search-ocr-adaptive-tiles-v1",
      }),
    );
    expect(configuration.ocr).toMatchObject({
      adaptiveTilingEnabled: true,
      tileOverlapPercent: 20,
      tileBatchSize: 4,
      maxTiles: 3,
      strategyVersion: "search-ocr-adaptive-tiles-v1",
    });
    for (const [key, value] of [
      ["OCR_SEARCH_TILE_OVERLAP_PERCENT", "11"],
      ["OCR_SEARCH_TILE_BATCH_SIZE", "5"],
      ["OCR_SEARCH_MAX_TILES", "0"],
      ["OCR_SEARCH_STRATEGY_VERSION", "search-ocr-adaptive-tiles-v2"],
    ] as const) {
      expect(() =>
        loadImageSearchConfiguration(localEnvironment({ [key]: value })),
      ).toThrow("IMAGE_SEARCH_CONFIGURATION_INVALID");
    }
  });

  it("rejects deterministic mode, a disabled AI gate, or a missing shared API key", () => {
    expect(() =>
      loadImageSearchConfiguration(
        localEnvironment({ IMAGE_SEARCH_INTERPRETER: "deterministic" }),
      ),
    ).toThrow("IMAGE_SEARCH_CONFIGURATION_INVALID");
    expect(() =>
      loadImageSearchConfiguration(
        localEnvironment({ IMAGE_SEARCH_OPENAI_ENABLED: "false" }),
      ),
    ).toThrow("IMAGE_SEARCH_EXTERNAL_APPROVALS_REQUIRED");
    expect(() =>
      loadImageSearchConfiguration(localEnvironment({ OPENAI_API_KEY: "" })),
    ).toThrow("IMAGE_SEARCH_EXTERNAL_APPROVALS_REQUIRED");
  });

  it("rejects filesystem storage and incomplete external approvals in production", () => {
    expect(() =>
      loadImageSearchConfiguration(localEnvironment({ APP_ENV: "production" })),
    ).toThrow("IMAGE_SEARCH_PRODUCTION_STORAGE_REQUIRED");
    expect(() =>
      loadImageSearchConfiguration(
        localEnvironment({
          APP_ENV: "production",
          IMAGE_SEARCH_STORAGE_ADAPTER: "s3",
          IMAGE_SEARCH_S3_BUCKET: "private-fixture-bucket",
          IMAGE_SEARCH_S3_REGION: "ap-southeast-1",
          IMAGE_SEARCH_S3_PREFIX: "image-search/",
          IMAGE_SEARCH_S3_KMS_KEY_ID: "fixture-key",
          IMAGE_SEARCH_S3_WORKER_ROLE_ARN:
            "arn:aws:iam::123456789012:role/smarthire-image-search",
          IMAGE_SEARCH_INTERPRETER: "openai",
          IMAGE_SEARCH_OPENAI_ENABLED: "true",
          IMAGE_SEARCH_OPENAI_DPA_APPROVED: "true",
          IMAGE_SEARCH_OPENAI_PRIVACY_APPROVED: "true",
          IMAGE_SEARCH_OPENAI_CROSS_BORDER_APPROVED: "false",
          IMAGE_SEARCH_OPENAI_ZDR_APPROVED: "true",
          OPENAI_API_KEY: "test-only",
        }),
      ),
    ).toThrow("IMAGE_SEARCH_EXTERNAL_APPROVALS_REQUIRED");
  });
});
