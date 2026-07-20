import type { ServerEnvironment } from "@/lib/env/server";

type CookieEnvironment = Pick<ServerEnvironment, "APP_ENV" | "SESSION_COOKIE_NAME" | "PRE_AUTH_COOKIE_NAME" | "COOKIE_SECURE">;

export function identityCookiePolicy(env: CookieEnvironment) {
  const common = { httpOnly: true as const, secure: env.COOKIE_SECURE, sameSite: "lax" as const };
  return {
    session: { name: env.SESSION_COOKIE_NAME, attributes: { ...common, path: "/" as const } },
    preAuth: { name: env.PRE_AUTH_COOKIE_NAME, attributes: { ...common, path: "/api/auth/two-factor" as const } },
  };
}

export function clearCookieAttributes<T extends { path: string; secure: boolean; httpOnly: true; sameSite: "lax" }>(attributes: T) {
  return { ...attributes, expires: new Date(0), maxAge: 0 };
}
