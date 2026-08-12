import "server-only";
import { z } from "zod";
import { isAbsolute } from "node:path";
import { loadImageSearchConfiguration } from "@/backend/image-search/config";
const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");
const optionalPort = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().int().min(1).max(65535).optional(),
);
const optionalBooleanString = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  booleanString.optional(),
);
const base64Key = z.string().refine((value) => {
  try {
    return (
      /^[A-Za-z0-9+/]+={0,2}$/u.test(value) &&
      value.length % 4 === 0 &&
      Buffer.from(value, "base64").byteLength === 32
    );
  } catch {
    return false;
  }
}, "must be a canonical base64-encoded 32-byte key");
const trustedProxyHops = z
  .string()
  .regex(/^(?:0|[1-9]|10)$/u)
  .default("0")
  .transform((value) => Number.parseInt(value, 10));
const mailbox = /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/;
const hasControlCharacter = (value: string) =>
  Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
const safeMailbox = z
  .string()
  .trim()
  .refine(
    (value) => !hasControlCharacter(value) && mailbox.test(value),
    "must be a complete email address",
  );
const smtpFrom = z
  .string()
  .trim()
  .refine((value) => {
    if (hasControlCharacter(value)) return false;
    const display = value.match(/^(?:[^<>]+\s)?<([^<>]+)>$/);
    return mailbox.test(display?.[1] ?? value);
  }, "must contain a safe complete email address")
  .optional()
  .or(z.literal(""));
const schema = z
  .object({
    APP_ENV: z.enum(["local", "test", "production"]),
    NEXT_PUBLIC_APP_URL: z.string().url(),
    DATABASE_URL: z.string().startsWith("postgresql://"),
    DIRECT_URL: z.string().startsWith("postgresql://"),
    BETTER_AUTH_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    TOKEN_SECRET: z.string().min(32),
    AUTH_COOKIE_ENV: z.enum(["local", "production"]),
    EMAIL_ADAPTER: z.enum(["capture", "resend", "smtp"]),
    EMAIL_CAPTURE_DIRECTORY: z.string().min(1),
    EMAIL_CAPTURE_DIR: z.string().min(1),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().email().optional().or(z.literal("")),
    SMTP_HOST: z.string().trim().min(1).optional(),
    SMTP_PORT: optionalPort,
    SMTP_USERNAME: safeMailbox.optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    SMTP_FROM: smtpFrom,
    SMTP_SECURE: optionalBooleanString,
    SMTP_USE_TLS: optionalBooleanString,
    SESSION_COOKIE_NAME: z.string().min(1),
    PRE_AUTH_COOKIE_NAME: z.string().min(1),
    COOKIE_SECURE: booleanString,
    COOKIE_SAME_SITE: z.literal("lax"),
    AUDIT_TRUSTED_PROXY_HOPS: trustedProxyHops,
    CV_STORAGE_ADAPTER: z.enum(["filesystem", "s3"]),
    CV_STORAGE_LOCAL_ROOT: z.string(),
    CV_ARTIFACT_ACTIVE_KEY_VERSION: z.literal("1").transform(Number),
    CV_ARTIFACT_KEY_V1: base64Key,
    CV_S3_BUCKET: z.string().trim().max(255).optional().or(z.literal("")),
    CV_S3_REGION: z.string().trim().max(100).optional().or(z.literal("")),
    CV_S3_KMS_KEY_ID: z.string().trim().max(2048).optional().or(z.literal("")),
    CV_CLAMD_SOCKET_PATH: z.literal("/run/clamav/clamd.sock"),
    CV_CLAMD_SIGNATURE_MAX_AGE_HOURS: z
      .enum(["24", "48"])
      .transform(Number),
    CV_PARSER_ADAPTER: z.enum(["deterministic", "openai"]),
    CV_OPENAI_ENABLED: booleanString,
    CV_OPENAI_LOCAL_DEV_ENABLED: booleanString,
    OPENAI_API_KEY: z.string().optional().or(z.literal("")),
    CV_OPENAI_MODEL: z.literal("gpt-5.4-mini-2026-03-17"),
    CV_OPENAI_DPA_APPROVED: booleanString,
    CV_OPENAI_CROSS_BORDER_APPROVED: booleanString,
    CV_OPENAI_ZDR_APPROVED: booleanString,
    CV_WORKER_ENABLED: booleanString,
    CV_CLEANUP_ENABLED: z.literal("true").transform(() => true),
    CV_SOURCE_MAX_BYTES: z.literal("5000000").transform(Number),
    CV_UPLOAD_ATTEMPTS_PER_HOUR: z.literal("5").transform(Number),
    CV_ACCOUNT_MAX_IMPORTS: z.literal("10").transform(Number),
    CV_ACCOUNT_MAX_STORAGE_BYTES: z.literal("52428800").transform(Number),
    CV_REJECTED_RETENTION_HOURS: z.literal("24").transform(Number),
    CV_UNCONFIRMED_RETENTION_DAYS: z.literal("30").transform(Number),
    CV_CONFIRMED_RETENTION_DAYS: z.literal("7").transform(Number),
    CV_CANDIDATE_DELETE_RETENTION_HOURS: z.literal("24").transform(Number),
    OCR_ENGINE_ENABLED: booleanString.optional(),
    OCR_ENGINE_SOCKET_PATH: z.string().optional(),
    OCR_ENGINE_NAME: z.string().optional(),
    OCR_ENGINE_VERSION: z.string().optional(),
    OCR_MODEL_NAME: z.string().optional(),
    OCR_MODEL_SHA256: z.string().optional(),
    OCR_POLICY_VERSION: z.string().optional(),
    OCR_CV_UNIT_TIMEOUT_SECONDS: z.string().optional(),
    CV_HYBRID_DEADLINE_SECONDS: z.string().optional(),
    OCR_SEARCH_TIMEOUT_SECONDS: z.string().optional(),
    IMAGE_SEARCH_WORKER_ENABLED: booleanString.optional(),
    IMAGE_SEARCH_CLEANUP_ENABLED: booleanString.optional(),
    IMAGE_SEARCH_STORAGE_ADAPTER: z.enum(["filesystem", "s3"]).optional(),
    IMAGE_SEARCH_STORAGE_LOCAL_ROOT: z.string().optional(),
    IMAGE_SEARCH_ARTIFACT_ACTIVE_KEY_VERSION: z.string().optional(),
    IMAGE_SEARCH_ARTIFACT_KEY_V1: base64Key.optional(),
    IMAGE_SEARCH_RATE_HMAC_KEY_V1: base64Key.optional(),
    IMAGE_SEARCH_CAPABILITY_HMAC_KEY_V1: base64Key.optional(),
    IMAGE_SEARCH_S3_BUCKET: z.string().optional(),
    IMAGE_SEARCH_S3_REGION: z.string().optional(),
    IMAGE_SEARCH_S3_PREFIX: z.string().optional(),
    IMAGE_SEARCH_S3_KMS_KEY_ID: z.string().optional(),
    IMAGE_SEARCH_S3_WORKER_ROLE_ARN: z.string().optional(),
    IMAGE_SEARCH_INTERPRETER: z.literal("openai").optional(),
    IMAGE_SEARCH_OPENAI_ENABLED: booleanString.optional(),
    IMAGE_SEARCH_OPENAI_MODEL: z.string().optional(),
    IMAGE_SEARCH_OPENAI_DPA_APPROVED: booleanString.optional(),
    IMAGE_SEARCH_OPENAI_PRIVACY_APPROVED: booleanString.optional(),
    IMAGE_SEARCH_OPENAI_CROSS_BORDER_APPROVED: booleanString.optional(),
    IMAGE_SEARCH_OPENAI_ZDR_APPROVED: booleanString.optional(),
    IMAGE_SEARCH_SOURCE_MAX_BYTES: z.string().optional(),
    IMAGE_SEARCH_MAX_DECODED_PIXELS: z.string().optional(),
    IMAGE_SEARCH_VISITOR_LIMIT_PER_HOUR: z.string().optional(),
    IMAGE_SEARCH_ACCOUNT_LIMIT_PER_HOUR: z.string().optional(),
    IMAGE_SEARCH_RETENTION_MINUTES: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const production = env.APP_ENV === "production";
    const appUrl = new URL(env.NEXT_PUBLIC_APP_URL);
    const authUrl = new URL(env.BETTER_AUTH_URL);
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (
      env.APP_ENV !== "local" &&
      env.CV_CLAMD_SIGNATURE_MAX_AGE_HOURS !== 24
    ) {
      fail(
        "CV_CLAMD_SIGNATURE_MAX_AGE_HOURS",
        "non-local environments require the 24-hour signature freshness policy",
      );
    }
    if (env.EMAIL_ADAPTER === "smtp") {
      if (!env.SMTP_HOST) fail("SMTP_HOST", "is required for SMTP");
      if (!env.SMTP_PORT) fail("SMTP_PORT", "is required for SMTP");
      if (!env.SMTP_USERNAME) fail("SMTP_USERNAME", "is required for SMTP");
      if (!env.SMTP_PASSWORD) fail("SMTP_PASSWORD", "is required for SMTP");
      if (!env.SMTP_FROM) fail("SMTP_FROM", "is required for SMTP");
      if (env.SMTP_SECURE === undefined)
        fail("SMTP_SECURE", "is required for SMTP");
      if (env.SMTP_USE_TLS === undefined)
        fail("SMTP_USE_TLS", "is required for SMTP");
      if (
        env.SMTP_HOST?.toLowerCase() === "smtp.gmail.com" &&
        env.SMTP_PORT === 587 &&
        (env.SMTP_SECURE !== false || env.SMTP_USE_TLS !== true)
      )
        fail(
          "SMTP_SECURE",
          "Gmail port 587 requires secure=false and STARTTLS",
        );
      if (
        env.SMTP_HOST?.toLowerCase() === "smtp.gmail.com" &&
        env.SMTP_PORT === 465 &&
        env.SMTP_SECURE !== true
      )
        fail("SMTP_SECURE", "Gmail port 465 requires secure=true");
    }
    if (
      env.CV_STORAGE_ADAPTER === "filesystem" &&
      !isAbsolute(env.CV_STORAGE_LOCAL_ROOT)
    ) {
      fail(
        "CV_STORAGE_LOCAL_ROOT",
        "filesystem storage requires an absolute root",
      );
    }
    if (env.CV_STORAGE_LOCAL_ROOT.includes("\0")) {
      fail("CV_STORAGE_LOCAL_ROOT", "must not contain NUL characters");
    }
    if (production) {
      if (env.CV_OPENAI_LOCAL_DEV_ENABLED)
        fail(
          "CV_OPENAI_LOCAL_DEV_ENABLED",
          "production forbids the local OpenAI development gate",
        );
      if (env.CV_STORAGE_ADAPTER !== "s3")
        fail("CV_STORAGE_ADAPTER", "production requires private S3 storage");
      if (!env.CV_S3_BUCKET || !env.CV_S3_REGION || !env.CV_S3_KMS_KEY_ID)
        fail("CV_S3_BUCKET", "production S3 settings must be complete");
      if (
        env.CV_PARSER_ADAPTER !== "openai" ||
        !env.CV_OPENAI_ENABLED ||
        !env.OPENAI_API_KEY
      )
        fail(
          "CV_PARSER_ADAPTER",
          "production requires the approved external parser",
        );
      if (
        !env.CV_OPENAI_DPA_APPROVED ||
        !env.CV_OPENAI_CROSS_BORDER_APPROVED ||
        !env.CV_OPENAI_ZDR_APPROVED
      )
        fail(
          "CV_OPENAI_ZDR_APPROVED",
          "production requires every privacy assertion",
        );
    } else if (env.APP_ENV === "test") {
      if (
        env.CV_STORAGE_ADAPTER !== "filesystem" ||
        env.CV_PARSER_ADAPTER !== "deterministic" ||
        env.CV_OPENAI_ENABLED ||
        env.CV_OPENAI_LOCAL_DEV_ENABLED
      )
        fail(
          "CV_PARSER_ADAPTER",
          "test environments require the network-free deterministic parser",
        );
    } else {
      const deterministicLocalParser =
        env.CV_STORAGE_ADAPTER === "filesystem" &&
        env.CV_PARSER_ADAPTER === "deterministic" &&
        !env.CV_OPENAI_ENABLED &&
        !env.CV_OPENAI_LOCAL_DEV_ENABLED;
      const explicitOpenAiLocalParser =
        env.CV_STORAGE_ADAPTER === "filesystem" &&
        env.CV_PARSER_ADAPTER === "openai" &&
        env.CV_OPENAI_ENABLED &&
        env.CV_OPENAI_LOCAL_DEV_ENABLED &&
        Boolean(env.OPENAI_API_KEY);
      if (!deterministicLocalParser && !explicitOpenAiLocalParser)
        fail(
          "CV_PARSER_ADAPTER",
          "local CV parsing requires deterministic mode or the explicit OpenAI development gate with an API key",
        );
    }
    if (appUrl.origin !== authUrl.origin)
      fail(
        "BETTER_AUTH_URL",
        "must exactly match the public application origin",
      );
    if (production) {
      if (env.AUDIT_TRUSTED_PROXY_HOPS < 1)
        fail(
          "AUDIT_TRUSTED_PROXY_HOPS",
          "production requires at least one trusted proxy hop",
        );
      if (appUrl.protocol !== "https:")
        fail("NEXT_PUBLIC_APP_URL", "production requires HTTPS");
      if (
        [appUrl.hostname, authUrl.hostname].some(
          (host) =>
            host === "localhost" || host === "127.0.0.1" || host.includes("*"),
        )
      )
        fail(
          "NEXT_PUBLIC_APP_URL",
          "production forbids localhost and wildcard hosts",
        );
      if (!env.COOKIE_SECURE)
        fail("COOKIE_SECURE", "production cookies must be Secure");
      if (!env.SESSION_COOKIE_NAME.startsWith("__Host-"))
        fail(
          "SESSION_COOKIE_NAME",
          "production session cookie requires __Host- prefix",
        );
      if (!env.PRE_AUTH_COOKIE_NAME.startsWith("__Secure-"))
        fail(
          "PRE_AUTH_COOKIE_NAME",
          "production pre-auth cookie requires __Secure- prefix",
        );
      if (
        env.EMAIL_ADAPTER !== "resend" ||
        !env.RESEND_API_KEY ||
        !env.EMAIL_FROM
      )
        fail("EMAIL_ADAPTER", "production requires configured Resend email");
    } else {
      if (env.COOKIE_SECURE)
        fail("COOKIE_SECURE", "local HTTP cookies must not be Secure");
      if (
        env.SESSION_COOKIE_NAME.startsWith("__Host-") ||
        env.PRE_AUTH_COOKIE_NAME.startsWith("__Secure-")
      )
        fail(
          "SESSION_COOKIE_NAME",
          "local insecure cookies must be unprefixed",
        );
    }
  });
export type ServerEnvironment = Readonly<z.infer<typeof schema>>;
export function parseServerEnvironment(
  input: NodeJS.ProcessEnv | Record<string, string | undefined>,
): ServerEnvironment {
  const forbiddenKeys = Object.keys(input).filter(
    (key) =>
      key.startsWith("NEXT_PUBLIC_CV_") ||
      (key.startsWith("NEXT_PUBLIC_") &&
        /(?:OCR|IMAGE_SEARCH|OPENAI)/u.test(key)) ||
      /^CV_CLAMD_(?:HOST|PORT|TCP|ADDR|ADDRESS)$/iu.test(key) ||
      /^OCR_ENGINE_(?:URL|HOST|PORT|TCP|ADDR|ADDRESS)$/iu.test(key) ||
      /^(?:CV_OPENAI_(?:BASE_URL|ENDPOINT)|OPENAI_BASE_URL)$/iu.test(key) ||
      (key === "CV_S3_VERSIONING_ENABLED" && input[key] !== "false") ||
      (key === "CV_S3_PUBLIC_ACCESS_ENABLED" && input[key] !== "false"),
  );
  if (forbiddenKeys.length > 0) {
    throw new Error(
      `Invalid server environment fields: ${forbiddenKeys.join(", ")}`,
    );
  }
  if (input.OCR_ENGINE_ENABLED !== undefined) {
    loadImageSearchConfiguration(input);
  }
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(
        result.error.issues.map((issue) => issue.path[0]).filter(Boolean),
      ),
    ].join(", ");
    throw new Error(`Invalid server environment fields: ${fields}`);
  }
  return Object.freeze(result.data);
}
