import { isAbsolute } from "node:path";

export const OCR_EXPECTED_MODEL_MANIFEST_SHA256 =
  "a8f8b2e10b1870bd35f1ec7a160399f5d4c6a6c6326c373abf01d7fdc9e38bba";
export const OCR_EXPECTED_ENGINE_VERSION = "1.1.0" as const;
export const OCR_SEARCH_STRATEGY_VERSION =
  "search-ocr-adaptive-tiles-v1" as const;

function fail(code = "IMAGE_SEARCH_CONFIGURATION_INVALID"): never {
  throw new Error(code);
}

type Environment = Record<string, string | undefined>;

function exact(environment: Environment, key: string, value: string): void {
  if (environment[key] !== value) fail();
}

function boolean(environment: Environment, key: string): boolean {
  if (!["true", "false"].includes(environment[key] ?? "")) fail();
  return environment[key] === "true";
}

function optionalBoolean(
  environment: Environment,
  key: string,
  fallback: boolean,
): boolean {
  const value = environment[key];
  if (value === undefined) return fallback;
  if (!["true", "false"].includes(value)) fail();
  return value === "true";
}

function optionalInteger(
  environment: Environment,
  key: string,
  fallback: number,
  allowed: readonly number[],
): number {
  const value = environment[key];
  if (value === undefined) return fallback;
  if (!/^[0-9]+$/u.test(value)) fail();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || !allowed.includes(parsed)) fail();
  return parsed;
}

function optionalExact(
  environment: Environment,
  key: string,
  fallback: string,
): string {
  const value = environment[key] ?? fallback;
  if (value !== fallback) fail();
  return value;
}

function decodedKey(environment: Environment, key: string): Buffer {
  const value = environment[key] ?? "";
  const decoded = Buffer.from(value, "base64");
  if (decoded.byteLength !== 32 || decoded.toString("base64") !== value) fail();
  return decoded;
}

export function loadImageSearchConfiguration(environment: Environment) {
  if (
    Object.keys(environment).some(
      (key) =>
        key.startsWith("NEXT_PUBLIC_") &&
        /(OCR|IMAGE_SEARCH|OPENAI)/u.test(key),
    )
  ) {
    fail("IMAGE_SEARCH_PUBLIC_CONFIGURATION_FORBIDDEN");
  }
  exact(environment, "OCR_ENGINE_SOCKET_PATH", "/run/smarthire-ocr/ocr.sock");
  exact(environment, "OCR_ENGINE_NAME", "paddleocr-onnx");
  exact(environment, "OCR_ENGINE_VERSION", OCR_EXPECTED_ENGINE_VERSION);
  exact(environment, "OCR_MODEL_NAME", "PP-OCRv6-medium");
  exact(environment, "OCR_MODEL_SHA256", OCR_EXPECTED_MODEL_MANIFEST_SHA256);
  exact(environment, "OCR_POLICY_VERSION", "ocr-confidence-v1");
  exact(environment, "OCR_CV_UNIT_TIMEOUT_SECONDS", "20");
  exact(environment, "CV_HYBRID_DEADLINE_SECONDS", "180");
  exact(environment, "OCR_SEARCH_TIMEOUT_SECONDS", "10");
  exact(environment, "IMAGE_SEARCH_SOURCE_MAX_BYTES", "5000000");
  exact(environment, "IMAGE_SEARCH_MAX_DECODED_PIXELS", "20000000");
  exact(environment, "IMAGE_SEARCH_VISITOR_LIMIT_PER_HOUR", "5");
  exact(environment, "IMAGE_SEARCH_ACCOUNT_LIMIT_PER_HOUR", "15");
  exact(environment, "IMAGE_SEARCH_RETENTION_MINUTES", "15");

  const adaptiveTilingEnabled = optionalBoolean(
    environment,
    "OCR_SEARCH_ADAPTIVE_TILING_ENABLED",
    false,
  );
  const tileOverlapPercent = optionalInteger(
    environment,
    "OCR_SEARCH_TILE_OVERLAP_PERCENT",
    15,
    [10, 15, 20],
  );
  const tileBatchSize = optionalInteger(
    environment,
    "OCR_SEARCH_TILE_BATCH_SIZE",
    2,
    [1, 2, 3, 4],
  );
  const maxTiles = optionalInteger(
    environment,
    "OCR_SEARCH_MAX_TILES",
    4,
    [1, 2, 3, 4],
  );
  const strategyVersion = optionalExact(
    environment,
    "OCR_SEARCH_STRATEGY_VERSION",
    OCR_SEARCH_STRATEGY_VERSION,
  );

  const keys = [
    decodedKey(environment, "IMAGE_SEARCH_ARTIFACT_KEY_V1"),
    decodedKey(environment, "IMAGE_SEARCH_RATE_HMAC_KEY_V1"),
    decodedKey(environment, "IMAGE_SEARCH_CAPABILITY_HMAC_KEY_V1"),
    decodedKey(environment, "CV_ARTIFACT_KEY_V1"),
  ].map((value) => value.toString("hex"));
  if (new Set(keys).size !== keys.length) {
    fail("IMAGE_SEARCH_KEY_SEPARATION_REQUIRED");
  }
  exact(environment, "IMAGE_SEARCH_ARTIFACT_ACTIVE_KEY_VERSION", "1");
  const adapter = environment.IMAGE_SEARCH_STORAGE_ADAPTER;
  if (!["filesystem", "s3"].includes(adapter ?? "")) fail();
  const applicationEnvironment = environment.APP_ENV;
  if (!["local", "test", "production"].includes(applicationEnvironment ?? "")) {
    fail();
  }
  const localRoot = environment.IMAGE_SEARCH_STORAGE_LOCAL_ROOT ?? "";
  if (adapter === "filesystem" && !isAbsolute(localRoot)) fail();
  if (applicationEnvironment === "production" && adapter !== "s3") {
    fail("IMAGE_SEARCH_PRODUCTION_STORAGE_REQUIRED");
  }
  exact(environment, "IMAGE_SEARCH_INTERPRETER", "openai");
  const workerEnabled = boolean(environment, "IMAGE_SEARCH_WORKER_ENABLED");
  const openAiEnabled = boolean(environment, "IMAGE_SEARCH_OPENAI_ENABLED");
  if (!openAiEnabled) fail("IMAGE_SEARCH_EXTERNAL_APPROVALS_REQUIRED");
  exact(environment, "IMAGE_SEARCH_OPENAI_MODEL", "gpt-5.4-mini-2026-03-17");
  const approvals = [
    "IMAGE_SEARCH_OPENAI_DPA_APPROVED",
    "IMAGE_SEARCH_OPENAI_PRIVACY_APPROVED",
    "IMAGE_SEARCH_OPENAI_CROSS_BORDER_APPROVED",
    "IMAGE_SEARCH_OPENAI_ZDR_APPROVED",
  ].map((key) => boolean(environment, key));
  if (
    ((applicationEnvironment === "production" || workerEnabled) &&
      !environment.OPENAI_API_KEY) ||
    (applicationEnvironment === "production" &&
      approvals.some((value) => !value))
  ) {
    fail("IMAGE_SEARCH_EXTERNAL_APPROVALS_REQUIRED");
  }
  if (applicationEnvironment === "production") {
    for (const key of [
      "IMAGE_SEARCH_S3_BUCKET",
      "IMAGE_SEARCH_S3_REGION",
      "IMAGE_SEARCH_S3_PREFIX",
      "IMAGE_SEARCH_S3_KMS_KEY_ID",
      "IMAGE_SEARCH_S3_WORKER_ROLE_ARN",
    ]) {
      if (!environment[key]) fail("IMAGE_SEARCH_PRODUCTION_STORAGE_REQUIRED");
    }
  }
  return {
    ocr: {
      enabled: boolean(environment, "OCR_ENGINE_ENABLED"),
      socketPath: environment.OCR_ENGINE_SOCKET_PATH!,
      engineName: environment.OCR_ENGINE_NAME!,
      engineVersion: environment.OCR_ENGINE_VERSION!,
      modelName: environment.OCR_MODEL_NAME!,
      modelManifestSha256: environment.OCR_MODEL_SHA256!,
      confidencePolicyVersion: environment.OCR_POLICY_VERSION!,
      cvUnitTimeoutMs: 20_000,
      cvHybridDeadlineMs: 180_000,
      searchTimeoutMs: 10_000,
      adaptiveTilingEnabled,
      tileOverlapPercent,
      tileBatchSize,
      maxTiles,
      strategyVersion,
    },
    workerEnabled,
    cleanupEnabled: boolean(environment, "IMAGE_SEARCH_CLEANUP_ENABLED"),
    storage: {
      adapter: adapter as "filesystem" | "s3",
      localRoot,
      activeKeyVersion: 1,
      s3:
        adapter === "s3"
          ? {
              bucket: environment.IMAGE_SEARCH_S3_BUCKET!,
              region: environment.IMAGE_SEARCH_S3_REGION!,
              prefix: environment.IMAGE_SEARCH_S3_PREFIX!,
              kmsKeyId: environment.IMAGE_SEARCH_S3_KMS_KEY_ID!,
              workerRoleArn: environment.IMAGE_SEARCH_S3_WORKER_ROLE_ARN!,
            }
          : null,
    },
    interpreter: {
      class: "EXTERNAL_OPENAI" as const,
      model: environment.IMAGE_SEARCH_OPENAI_MODEL!,
    },
    sourceMaximumBytes: 5_000_000,
    maximumDecodedPixels: 20_000_000,
    visitorLimitPerHour: 5,
    accountLimitPerHour: 15,
    retentionMs: 15 * 60_000,
  };
}
