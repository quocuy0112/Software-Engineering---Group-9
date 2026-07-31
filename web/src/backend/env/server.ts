import "server-only";
import { z } from "zod";
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
  })
  .superRefine((env, ctx) => {
    const production = env.APP_ENV === "production";
    const appUrl = new URL(env.NEXT_PUBLIC_APP_URL);
    const authUrl = new URL(env.BETTER_AUTH_URL);
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
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
export type ServerEnvironment = z.infer<typeof schema>;
export function parseServerEnvironment(
  input: NodeJS.ProcessEnv | Record<string, string | undefined>,
): ServerEnvironment {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(
        result.error.issues.map((issue) => issue.path[0]).filter(Boolean),
      ),
    ].join(", ");
    throw new Error(`Invalid server environment fields: ${fields}`);
  }
  return result.data;
}
