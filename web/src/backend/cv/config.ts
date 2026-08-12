import "server-only";

import type { ServerEnvironment } from "@/backend/env/server";
import { serverEnvironment } from "@/backend/env/runtime";

export const CV_APPROVED_OPENAI_ENDPOINT = "https://api.openai.com/v1" as const;
export const CV_APPROVED_OPENAI_MODEL = "gpt-5.4-mini-2026-03-17" as const;

export type CvConfiguration = Readonly<{
  storage: Readonly<{
    adapter: "filesystem" | "s3";
    localRoot: string | null;
    s3: Readonly<{
      bucket: string;
      region: string;
      kmsKeyId: string;
      requireBlockPublicAccess: true;
      requireVersioningDisabled: true;
    }> | null;
  }>;
  encryption: Readonly<{
    activeKeyVersion: 1;
    encodedKeys: Readonly<Record<"1", string>>;
  }>;
  scanner: Readonly<{
    transport: "unix";
    socketPath: "/run/clamav/clamd.sock";
    signatureMaximumAgeHours: number;
  }>;
  parser: Readonly<{
    adapter: "deterministic" | "openai";
    deterministicEnabled: boolean;
    endpoint: typeof CV_APPROVED_OPENAI_ENDPOINT;
    model: typeof CV_APPROVED_OPENAI_MODEL;
    enabled: boolean;
    apiKey: string | null;
    privacyApproved: boolean;
    localDevelopmentEnabled: boolean;
  }>;
  workerEnabled: boolean;
  cleanupEnabled: true;
  limits: Readonly<{
    sourceMaximumBytes: 5_000_000;
    uploadAttemptsPerRollingHour: 5;
    accountMaximumImports: 10;
    accountMaximumStorageBytes: 52_428_800;
    rejectedRetentionHours: 24;
    unconfirmedRetentionDays: 30;
    confirmedRetentionDays: 7;
    candidateDeleteRetentionHours: 24;
  }>;
}>;

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

export function createCvConfiguration(env: ServerEnvironment): CvConfiguration {
  const s3 =
    env.CV_STORAGE_ADAPTER === "s3"
      ? frozen({
          bucket: env.CV_S3_BUCKET ?? "",
          region: env.CV_S3_REGION ?? "",
          kmsKeyId: env.CV_S3_KMS_KEY_ID ?? "",
          requireBlockPublicAccess: true as const,
          requireVersioningDisabled: true as const,
        })
      : null;
  const privacyApproved =
    env.CV_OPENAI_DPA_APPROVED &&
    env.CV_OPENAI_CROSS_BORDER_APPROVED &&
    env.CV_OPENAI_ZDR_APPROVED;

  return frozen({
    storage: frozen({
      adapter: env.CV_STORAGE_ADAPTER,
      localRoot:
        env.CV_STORAGE_ADAPTER === "filesystem"
          ? env.CV_STORAGE_LOCAL_ROOT
          : null,
      s3,
    }),
    encryption: frozen({
      activeKeyVersion: 1 as const,
      encodedKeys: frozen({ "1": env.CV_ARTIFACT_KEY_V1 }),
    }),
    scanner: frozen({
      transport: "unix" as const,
      socketPath: env.CV_CLAMD_SOCKET_PATH,
      signatureMaximumAgeHours: env.CV_CLAMD_SIGNATURE_MAX_AGE_HOURS,
    }),
    parser: frozen({
      adapter: env.CV_PARSER_ADAPTER,
      deterministicEnabled: env.APP_ENV !== "production",
      endpoint: CV_APPROVED_OPENAI_ENDPOINT,
      model: CV_APPROVED_OPENAI_MODEL,
      enabled: env.CV_OPENAI_ENABLED,
      apiKey: env.OPENAI_API_KEY || null,
      privacyApproved,
      localDevelopmentEnabled:
        env.APP_ENV === "local" && env.CV_OPENAI_LOCAL_DEV_ENABLED,
    }),
    workerEnabled: env.CV_WORKER_ENABLED,
    cleanupEnabled: true as const,
    limits: frozen({
      sourceMaximumBytes: 5_000_000 as const,
      uploadAttemptsPerRollingHour: 5 as const,
      accountMaximumImports: 10 as const,
      accountMaximumStorageBytes: 52_428_800 as const,
      rejectedRetentionHours: 24 as const,
      unconfirmedRetentionDays: 30 as const,
      confirmedRetentionDays: 7 as const,
      candidateDeleteRetentionHours: 24 as const,
    }),
  });
}

export function cvParserAvailability(
  configuration: CvConfiguration,
): Readonly<{ deterministic: boolean; external: boolean }> {
  return frozen({
    deterministic: configuration.parser.deterministicEnabled,
    external:
      configuration.parser.adapter === "openai" &&
      configuration.parser.enabled &&
      Boolean(configuration.parser.apiKey) &&
      (configuration.parser.privacyApproved ||
        configuration.parser.localDevelopmentEnabled),
  });
}

export const cvConfiguration = createCvConfiguration(serverEnvironment);
