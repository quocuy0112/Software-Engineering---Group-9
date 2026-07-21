import type { ServerEnvironment } from "@/lib/env/server";
import { PRE_AUTH_COOKIE_MAX_AGE_SECONDS, PRE_AUTH_COOKIE_PATH } from "@/lib/security/cookies";

export type AuthCookiePolicy = {
  sessionName: string;
  preAuthName: string;
  attributes: { httpOnly: true; sameSite: "lax"; secure: boolean; path: "/" };
};

export function authCookiePolicy(env: Pick<ServerEnvironment, "APP_ENV" | "SESSION_COOKIE_NAME" | "PRE_AUTH_COOKIE_NAME" | "COOKIE_SECURE">): AuthCookiePolicy {
  return {
    sessionName: env.SESSION_COOKIE_NAME,
    preAuthName: env.PRE_AUTH_COOKIE_NAME,
    attributes: { httpOnly: true, sameSite: "lax", secure: env.COOKIE_SECURE, path: "/" },
  };
}

export function betterAuthCookieOptions(policy: AuthCookiePolicy) {
  return {
    useSecureCookies: false,
    disableCSRFCheck: false,
    disableOriginCheck: false,
    crossSubDomainCookies: { enabled: false as const },
    defaultCookieAttributes: policy.attributes,
    cookies: {
      session_token: { name: policy.sessionName, attributes: policy.attributes },
      two_factor: {
        name: policy.preAuthName,
        attributes: { ...policy.attributes, path: PRE_AUTH_COOKIE_PATH, maxAge: PRE_AUTH_COOKIE_MAX_AGE_SECONDS },
      },
    },
  };
}
