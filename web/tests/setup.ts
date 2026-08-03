import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { resolve } from "node:path";
import { afterEach } from "vitest";

const cvTestEnvironment = {
  CV_STORAGE_ADAPTER: "filesystem",
  CV_STORAGE_LOCAL_ROOT: resolve(process.cwd(), ".local/cv-storage-test"),
  CV_ARTIFACT_ACTIVE_KEY_VERSION: "1",
  CV_ARTIFACT_KEY_V1: Buffer.alloc(32, 0x74).toString("base64"),
  CV_CLAMD_SOCKET_PATH: "/run/clamav/clamd.sock",
  CV_CLAMD_SIGNATURE_MAX_AGE_HOURS: "24",
  CV_PARSER_ADAPTER: "deterministic",
  CV_OPENAI_ENABLED: "false",
  CV_OPENAI_MODEL: "gpt-5.4-mini-2026-03-17",
  CV_OPENAI_DPA_APPROVED: "false",
  CV_OPENAI_CROSS_BORDER_APPROVED: "false",
  CV_OPENAI_ZDR_APPROVED: "false",
  CV_WORKER_ENABLED: "false",
  CV_CLEANUP_ENABLED: "true",
  CV_SOURCE_MAX_BYTES: "5000000",
  CV_UPLOAD_ATTEMPTS_PER_HOUR: "5",
  CV_ACCOUNT_MAX_IMPORTS: "10",
  CV_ACCOUNT_MAX_STORAGE_BYTES: "52428800",
  CV_REJECTED_RETENTION_HOURS: "24",
  CV_UNCONFIRMED_RETENTION_DAYS: "30",
  CV_CONFIRMED_RETENTION_DAYS: "7",
  CV_CANDIDATE_DELETE_RETENTION_HOURS: "24",
} as const;

for (const [key, value] of Object.entries(cvTestEnvironment)) {
  process.env[key] ??= value;
}

afterEach(cleanup);
