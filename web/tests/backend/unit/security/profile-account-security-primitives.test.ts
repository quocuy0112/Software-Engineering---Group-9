import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { ControlledClock, UtcSystemClock } from "@/backend/time/clock";
import { parseServerEnvironment } from "@/backend/env/server";
import { PlainTextNormalizer } from "@/backend/security/plain-text/plain-text-normalizer";
import {
  ProtectedOutboxRecipient,
  type ProtectedRecipientPurpose,
} from "@/backend/security/protected-recipient/protected-outbox-recipient";
import {
  NetworkSourceProtector,
  reduceNetworkPrefix,
} from "@/backend/security/network-source/network-source-protector";

const secret = "profile-account-security-test-secret-32-bytes";
const purpose: ProtectedRecipientPurpose = "email-change-verification.v1";

const localEnvironment = {
  APP_ENV: "local",
  NEXT_PUBLIC_APP_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/smarthire",
  DIRECT_URL: "postgresql://postgres:postgres@localhost:5432/smarthire",
  BETTER_AUTH_URL: "http://localhost:3001",
  BETTER_AUTH_SECRET: secret,
  TOKEN_SECRET: secret,
  AUTH_COOKIE_ENV: "local",
  EMAIL_ADAPTER: "capture",
  EMAIL_CAPTURE_DIRECTORY: ".email-capture",
  EMAIL_CAPTURE_DIR: ".email-capture",
  SESSION_COOKIE_NAME: "better-auth.session_token",
  PRE_AUTH_COOKIE_NAME: "smarthire.pre_auth",
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
} as const;

describe("profile/account security primitives", () => {
  it("normalizes NFKC Unicode, preserves Vietnamese, and emits plain text only", () => {
    const result = new PlainTextNormalizer().normalize(
      "  Ｐｒｏｆｉｌｅ  Đặng   Thùy <img src=x onerror=alert(1)> <script>boom()</script> ",
      { field: "headline", maxCodePoints: 200 },
    );
    expect(result.value).toBe("Profile Đặng Thùy");
    expect(result.value).not.toMatch(/[<>]|alert|boom/);
  });

  it("turns sanitized optional empties into null with a safe warning", () => {
    expect(
      new PlainTextNormalizer().normalize("<script>alert(1)</script>", {
        field: "summary",
        maxCodePoints: 5_000,
      }),
    ).toEqual({
      value: null,
      warnings: [{ field: "summary", code: "SANITIZED_TO_EMPTY" }],
    });
  });

  it("purpose-binds authenticated recipient encryption and detects tampering", () => {
    const protector = new ProtectedOutboxRecipient(secret);
    const ciphertext = protector.seal("candidate@example.test", purpose);
    expect(ciphertext).not.toContain("candidate@example.test");
    expect(protector.unseal(ciphertext, purpose)).toBe(
      "candidate@example.test",
    );
    expect(() =>
      protector.unseal(ciphertext, "password-change-notice.v1"),
    ).toThrow();
    const tampered = `${ciphertext.slice(0, -1)}${
      ciphertext.endsWith("A") ? "B" : "A"
    }`;
    expect(() => protector.unseal(tampered, purpose)).toThrow();
  });

  it("parses trusted hops strictly and fails closed in production", () => {
    expect(
      parseServerEnvironment(localEnvironment).AUDIT_TRUSTED_PROXY_HOPS,
    ).toBe(0);
    expect(() =>
      parseServerEnvironment({
        ...localEnvironment,
        APP_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://jobs.example.test",
        BETTER_AUTH_URL: "https://jobs.example.test",
        AUTH_COOKIE_ENV: "production",
        COOKIE_SECURE: "true",
        SESSION_COOKIE_NAME: "__Host-better-auth.session_token",
        PRE_AUTH_COOKIE_NAME: "__Secure-smarthire.pre_auth",
        EMAIL_ADAPTER: "resend",
        RESEND_API_KEY: "re_test_key",
        EMAIL_FROM: "security@example.test",
        AUDIT_TRUSTED_PROXY_HOPS: "0",
      }),
    ).toThrow(/AUDIT_TRUSTED_PROXY_HOPS/);
    expect(() =>
      parseServerEnvironment({
        ...localEnvironment,
        AUDIT_TRUSTED_PROXY_HOPS: "1;198.51.100.10",
      }),
    ).toThrow(/AUDIT_TRUSTED_PROXY_HOPS/);
  });

  it("reduces IPv4 to /24 and IPv6 to /56 before purpose-separated HMAC", () => {
    expect(reduceNetworkPrefix("203.0.113.9")).toBe("203.0.113.0/24");
    expect(reduceNetworkPrefix("2001:db8:abcd:12ff::1")).toBe(
      "2001:db8:abcd:1200::/56",
    );
    const protector = new NetworkSourceProtector(secret, 1);
    const first = protector.protect({
      remoteAddress: "10.0.0.10",
      forwardedFor: "203.0.113.9",
    });
    const samePrefix = protector.protect({
      remoteAddress: "10.0.0.11",
      forwardedFor: "203.0.113.250",
    });
    const otherPrefix = protector.protect({
      remoteAddress: "10.0.0.12",
      forwardedFor: "203.0.114.9",
    });
    expect(first.ipPrefixDigest).toBe(samePrefix.ipPrefixDigest);
    expect(first.ipPrefixDigest).not.toBe(otherPrefix.ipPrefixDigest);
    expect(first.ipPrefixDigest).not.toContain("203.0.113");
  });

  it("uses injectable UTC clocks without exposing mutable Date instances", () => {
    const clock = new ControlledClock("2026-07-31T02:00:00.000Z");
    const first = clock.now();
    first.setUTCFullYear(2030);
    expect(clock.now().toISOString()).toBe("2026-07-31T02:00:00.000Z");
    clock.advanceBy(2_000);
    expect(clock.now().toISOString()).toBe("2026-07-31T02:00:02.000Z");
    expect(new UtcSystemClock().now()).toBeInstanceOf(Date);
  });
});
