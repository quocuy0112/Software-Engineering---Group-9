import "server-only";
import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");
const schema = z.object({
  APP_ENV: z.enum(["local", "test", "production"]),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  DIRECT_URL: z.string().startsWith("postgresql://"),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  TOKEN_SECRET: z.string().min(32),
  AUTH_COOKIE_ENV: z.enum(["local", "production"]),
  EMAIL_DRIVER: z.enum(["capture", "resend"]),
  EMAIL_ADAPTER: z.enum(["capture", "resend"]),
  EMAIL_CAPTURE_DIRECTORY: z.string().min(1),
  EMAIL_CAPTURE_DIR: z.string().min(1),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional().or(z.literal("")),
  SESSION_COOKIE_NAME: z.string().min(1),
  PRE_AUTH_COOKIE_NAME: z.string().min(1),
  COOKIE_SECURE: booleanString,
  COOKIE_SAME_SITE: z.literal("lax"),
}).superRefine((env, ctx) => {
  const production = env.APP_ENV === "production";
  const appUrl = new URL(env.NEXT_PUBLIC_APP_URL);
  const authUrl = new URL(env.BETTER_AUTH_URL);
  const fail = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (appUrl.origin !== authUrl.origin) fail("BETTER_AUTH_URL", "must exactly match the public application origin");
  if (production) {
    if (appUrl.protocol !== "https:") fail("NEXT_PUBLIC_APP_URL", "production requires HTTPS");
    if ([appUrl.hostname, authUrl.hostname].some((host) => host === "localhost" || host === "127.0.0.1" || host.includes("*"))) fail("NEXT_PUBLIC_APP_URL", "production forbids localhost and wildcard hosts");
    if (!env.COOKIE_SECURE) fail("COOKIE_SECURE", "production cookies must be Secure");
    if (!env.SESSION_COOKIE_NAME.startsWith("__Host-")) fail("SESSION_COOKIE_NAME", "production session cookie requires __Host- prefix");
    if (!env.PRE_AUTH_COOKIE_NAME.startsWith("__Secure-")) fail("PRE_AUTH_COOKIE_NAME", "production pre-auth cookie requires __Secure- prefix");
    if (env.EMAIL_ADAPTER !== "resend" || env.EMAIL_DRIVER !== "resend" || !env.RESEND_API_KEY || !env.EMAIL_FROM) fail("EMAIL_ADAPTER", "production requires configured Resend email");
  } else {
    if (env.COOKIE_SECURE) fail("COOKIE_SECURE", "local HTTP cookies must not be Secure");
    if (env.SESSION_COOKIE_NAME.startsWith("__Host-") || env.PRE_AUTH_COOKIE_NAME.startsWith("__Secure-")) fail("SESSION_COOKIE_NAME", "local insecure cookies must be unprefixed");
  }
});

export type ServerEnvironment = z.infer<typeof schema>;
export function parseServerEnvironment(input: NodeJS.ProcessEnv | Record<string, string | undefined>): ServerEnvironment {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path[0]).filter(Boolean))].join(", ");
    throw new Error(`Invalid server environment fields: ${fields}`);
  }
  return result.data;
}
