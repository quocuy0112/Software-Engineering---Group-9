import "server-only";
import type { AccountRecoveryCapabilityKind } from "@/shared/contracts/identity/password-recovery";
import { accountRecoveryCapabilitySchema } from "@/shared/contracts/identity/password-recovery";
import { serverEnvironment } from "@/backend/env/runtime";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";

export const ACCOUNT_RECOVERY_CAPABILITY_PATH =
  "/api/identity/account-recovery" as const;
export const ACCOUNT_RECOVERY_CAPABILITY_MAX_AGE_SECONDS = 5 * 60;

type CapabilityPayload = {
  version: 1;
  kind: AccountRecoveryCapabilityKind;
  proof: string;
  expiresAt: number;
};

function cookieName() {
  return serverEnvironment.COOKIE_SECURE
    ? "__Secure-smarthire.recovery-capability"
    : "smarthire.recovery-capability";
}

function serialize(value: string, maxAge: number, expires?: Date) {
  return [
    `${cookieName()}=${encodeURIComponent(value)}`,
    `Path=${ACCOUNT_RECOVERY_CAPABILITY_PATH}`,
    "HttpOnly",
    "SameSite=Strict",
    serverEnvironment.COOKIE_SECURE && "Secure",
    `Max-Age=${maxAge}`,
    expires && `Expires=${expires.toUTCString()}`,
  ]
    .filter(Boolean)
    .join("; ");
}

function cookieValue(headers: Headers) {
  const name = cookieName();
  const part = headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((value) => value.startsWith(`${name}=`));
  if (!part) return null;
  try {
    return decodeURIComponent(part.slice(name.length + 1));
  } catch {
    return null;
  }
}

export function issueAccountRecoveryCapability(
  kind: AccountRecoveryCapabilityKind,
  proof: string,
  now = new Date(),
  protector = new TokenProtector(),
) {
  const payload: CapabilityPayload = {
    version: 1,
    kind,
    proof,
    expiresAt:
      now.getTime() + ACCOUNT_RECOVERY_CAPABILITY_MAX_AGE_SECONDS * 1000,
  };
  return serialize(
    protector.seal(JSON.stringify(payload)),
    ACCOUNT_RECOVERY_CAPABILITY_MAX_AGE_SECONDS,
  );
}

export function clearAccountRecoveryCapability() {
  return serialize("", 0, new Date(0));
}

export function readAccountRecoveryCapability(
  headers: Headers,
  expectedKind: AccountRecoveryCapabilityKind,
  now = new Date(),
  protector = new TokenProtector(),
) {
  const sealed = cookieValue(headers);
  if (!sealed) return null;
  try {
    const payload = JSON.parse(
      protector.unseal(sealed),
    ) as Partial<CapabilityPayload>;
    const parsed = accountRecoveryCapabilitySchema.safeParse({
      kind: payload.kind,
      proof: payload.proof,
    });
    const maximumExpiry =
      now.getTime() + ACCOUNT_RECOVERY_CAPABILITY_MAX_AGE_SECONDS * 1000;
    if (
      payload.version !== 1 ||
      !parsed.success ||
      parsed.data.kind !== expectedKind ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= now.getTime() ||
      payload.expiresAt > maximumExpiry
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
