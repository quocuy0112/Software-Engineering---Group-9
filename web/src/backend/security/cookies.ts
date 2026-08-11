import type { ServerEnvironment } from "@/backend/env/server";
import { serverEnvironment } from "@/backend/env/runtime";

type CookieEnvironment = Pick<
  ServerEnvironment,
  "APP_ENV" | "SESSION_COOKIE_NAME" | "PRE_AUTH_COOKIE_NAME" | "COOKIE_SECURE"
>;

/**
 * Path the non-authenticating challenge cookie is scoped to. It must cover the
 * two-factor completion Route Handler (`/api/identity/two-factor/complete`) so
 * the browser sends the cookie there, while staying narrow enough that it is
 * never presented to protected resource guards under `/` or `/settings`.
 */
export const PRE_AUTH_COOKIE_PATH =
  "/api/identity/two-factor/complete" as const;

/**
 * Admin sign-in completes the same non-authenticating challenge through its
 * own origin-scoped route. Keeping a distinct narrow path lets the browser
 * deliver the challenge without exposing it to unrelated admin endpoints.
 */
export const ADMIN_PRE_AUTH_COOKIE_PATH = "/api/admin/auth/two-factor" as const;

export type PreAuthCookiePath =
  | typeof PRE_AUTH_COOKIE_PATH
  | typeof ADMIN_PRE_AUTH_COOKIE_PATH;

/** Maximum challenge-cookie lifetime: five minutes, matching the AuthenticationChallenge expiry. */
export const PRE_AUTH_COOKIE_MAX_AGE_SECONDS = 5 * 60;

export function identityCookiePolicy(env: CookieEnvironment) {
  const common = {
    httpOnly: true as const,
    secure: env.COOKIE_SECURE,
    sameSite: "lax" as const,
  };
  return {
    session: {
      name: env.SESSION_COOKIE_NAME,
      attributes: { ...common, path: "/" as const },
    },
    preAuth: {
      name: env.PRE_AUTH_COOKIE_NAME,
      attributes: {
        ...common,
        path: PRE_AUTH_COOKIE_PATH,
        maxAge: PRE_AUTH_COOKIE_MAX_AGE_SECONDS,
      },
    },
  };
}

export function clearCookieAttributes<
  T extends { path: string; secure: boolean; httpOnly: true; sameSite: "lax" },
>(attributes: T) {
  // Clearing must repeat the same path/secure/httpOnly/sameSite so the browser
  // matches and removes the exact cookie; drop any positive lifetime.
  const rest = { ...attributes } as Omit<T, "maxAge"> & { maxAge?: number };
  delete rest.maxAge;
  return { ...rest, expires: new Date(0), maxAge: 0 };
}

export function clearSessionCookie() {
  const policy = identityCookiePolicy(serverEnvironment);
  const attributes = clearCookieAttributes(policy.session.attributes);
  return [
    `${policy.session.name}=`,
    `Path=${attributes.path}`,
    "HttpOnly",
    "SameSite=Lax",
    attributes.secure && "Secure",
    "Max-Age=0",
    `Expires=${attributes.expires.toUTCString()}`,
  ]
    .filter(Boolean)
    .join("; ");
}
