import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { parseServerEnvironment } from "@/backend/env/server";
const local = {
  APP_ENV: "local",
  NEXT_PUBLIC_APP_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://user:pass@localhost:55432/db",
  DIRECT_URL: "postgresql://user:pass@localhost:55432/db",
  BETTER_AUTH_URL: "http://localhost:3001",
  BETTER_AUTH_SECRET: "a".repeat(32),
  TOKEN_SECRET: "b".repeat(32),
  AUTH_COOKIE_ENV: "local",
  EMAIL_ADAPTER: "capture",
  EMAIL_CAPTURE_DIRECTORY: ".local/mail",
  EMAIL_CAPTURE_DIR: ".local/mail",
  SESSION_COOKIE_NAME: "smarthire.session",
  PRE_AUTH_COOKIE_NAME: "smarthire.pre-auth",
  COOKIE_SECURE: "false",
  COOKIE_SAME_SITE: "lax",
  AUDIT_TRUSTED_PROXY_HOPS: "0",
  CV_STORAGE_ADAPTER: "filesystem",
  CV_STORAGE_LOCAL_ROOT: resolve(".local/cv-storage"),
  CV_ARTIFACT_ACTIVE_KEY_VERSION: "1",
  CV_ARTIFACT_KEY_V1: Buffer.alloc(32).toString("base64"),
  CV_S3_BUCKET: "",
  CV_S3_REGION: "",
  CV_S3_KMS_KEY_ID: "",
  CV_CLAMD_SOCKET_PATH: "/run/clamav/clamd.sock",
  CV_CLAMD_SIGNATURE_MAX_AGE_HOURS: "24",
  CV_PARSER_ADAPTER: "deterministic",
  CV_OPENAI_ENABLED: "false",
  CV_OPENAI_LOCAL_DEV_ENABLED: "false",
  OPENAI_API_KEY: "",
  CV_OPENAI_MODEL: "gpt-5.4-mini-2026-03-17",
  CV_OPENAI_DPA_APPROVED: "false",
  CV_OPENAI_CROSS_BORDER_APPROVED: "false",
  CV_OPENAI_ZDR_APPROVED: "false",
  CV_WORKER_ENABLED: "true",
  CV_CLEANUP_ENABLED: "true",
  CV_SOURCE_MAX_BYTES: "5000000",
  CV_UPLOAD_ATTEMPTS_PER_HOUR: "5",
  CV_ACCOUNT_MAX_IMPORTS: "10",
  CV_ACCOUNT_MAX_STORAGE_BYTES: "52428800",
  CV_REJECTED_RETENTION_HOURS: "24",
  CV_UNCONFIRMED_RETENTION_DAYS: "30",
  CV_CONFIRMED_RETENTION_DAYS: "7",
  CV_CANDIDATE_DELETE_RETENTION_HOURS: "24",
};
describe("server environment", () => {
  it("accepts local and secure production matrices", () => {
    expect(parseServerEnvironment(local).COOKIE_SECURE).toBe(false);
    expect(
      parseServerEnvironment({
        ...local,
        APP_ENV: "production",
        AUTH_COOKIE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://smarthire.example",
        BETTER_AUTH_URL: "https://smarthire.example",
        COOKIE_SECURE: "true",
        SESSION_COOKIE_NAME: "__Host-smarthire.session",
        PRE_AUTH_COOKIE_NAME: "__Secure-smarthire.pre-auth",
        EMAIL_ADAPTER: "resend",
        RESEND_API_KEY: "re_example",
        EMAIL_FROM: "no-reply@smarthire.example",
        AUDIT_TRUSTED_PROXY_HOPS: "1",
        CV_STORAGE_ADAPTER: "s3",
        CV_S3_BUCKET: "smarthire-production-private",
        CV_S3_REGION: "ap-southeast-1",
        CV_S3_KMS_KEY_ID: "alias/smarthire-cv",
        CV_PARSER_ADAPTER: "openai",
        CV_OPENAI_ENABLED: "true",
        CV_OPENAI_LOCAL_DEV_ENABLED: "false",
        OPENAI_API_KEY: "synthetic-production-key",
        CV_OPENAI_DPA_APPROVED: "true",
        CV_OPENAI_CROSS_BORDER_APPROVED: "true",
        CV_OPENAI_ZDR_APPROVED: "true",
      }).APP_ENV,
    ).toBe("production");
  });
  it("allows OpenAI locally only through the explicit development gate", () => {
    const localOpenAi = {
      ...local,
      CV_PARSER_ADAPTER: "openai",
      CV_OPENAI_ENABLED: "true",
      CV_OPENAI_LOCAL_DEV_ENABLED: "true",
      OPENAI_API_KEY: "synthetic-local-key",
    };
    expect(parseServerEnvironment(localOpenAi)).toMatchObject({
      APP_ENV: "local",
      CV_PARSER_ADAPTER: "openai",
      CV_OPENAI_ENABLED: true,
      CV_OPENAI_LOCAL_DEV_ENABLED: true,
    });
    expect(() =>
      parseServerEnvironment({
        ...localOpenAi,
        CV_OPENAI_LOCAL_DEV_ENABLED: "false",
      }),
    ).toThrow(/CV_PARSER_ADAPTER/);
  });
  it("rejects unsafe cookies/origins and redacts secrets", () => {
    expect(() =>
      parseServerEnvironment({
        ...local,
        SESSION_COOKIE_NAME: "__Host-smarthire.session",
      }),
    ).toThrow(/SESSION_COOKIE_NAME/);
    expect(() =>
      parseServerEnvironment({
        ...local,
        APP_ENV: "production",
        AUTH_COOKIE_ENV: "production",
      }),
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
    const secret = "short-secret";
    expect(() =>
      parseServerEnvironment({ ...local, BETTER_AUTH_SECRET: secret }),
    ).toThrowError(new RegExp(`^(?!.*${secret}).*$`));
  });
});
describe("SMTP environment validation", () => {
  const smtp = {
    ...local,
    EMAIL_ADAPTER: "smtp",
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: "587",
    SMTP_USERNAME: "developer@gmail.com",
    SMTP_PASSWORD: "app-password",
    SMTP_FROM: "SmartHire <developer@gmail.com>",
    SMTP_SECURE: "false",
    SMTP_USE_TLS: "true",
  };
  it("accepts Gmail 587 STARTTLS and 465 implicit TLS", () => {
    expect(parseServerEnvironment(smtp)).toMatchObject({
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USE_TLS: true,
    });
    expect(
      parseServerEnvironment({
        ...smtp,
        SMTP_PORT: "465",
        SMTP_SECURE: "true",
        SMTP_USE_TLS: "false",
      }),
    ).toMatchObject({ SMTP_PORT: 465, SMTP_SECURE: true });
  });
  it.each([
    ["missing username", { SMTP_USERNAME: undefined }],
    ["missing password", { SMTP_PASSWORD: undefined }],
    ["invalid port", { SMTP_PORT: "70000" }],
    ["incomplete username", { SMTP_USERNAME: "developer" }],
    [
      "malformed username",
      { SMTP_USERNAME: "SmartHire <developer@gmail.com>" },
    ],
    ["invalid sender", { SMTP_FROM: "SmartHire developer-at-gmail" }],
    ["sender without complete address", { SMTP_FROM: "SmartHire" }],
    [
      "CRLF injection",
      {
        SMTP_FROM: "SmartHire <developer@gmail.com>\r\nBcc: victim@example.com",
      },
    ],
    ["NUL injection", { SMTP_FROM: "SmartHire\0 <developer@gmail.com>" }],
    ["587 cannot use implicit TLS", { SMTP_PORT: "587", SMTP_SECURE: "true" }],
    ["465 requires implicit TLS", { SMTP_PORT: "465", SMTP_SECURE: "false" }],
  ])("rejects %s without exposing credentials", (_name, override) => {
    const password = "never-print-this";
    expect(() =>
      parseServerEnvironment({ ...smtp, SMTP_PASSWORD: password, ...override }),
    ).toThrowError(new RegExp(`^(?!.*${password}).*$`));
  });
});
