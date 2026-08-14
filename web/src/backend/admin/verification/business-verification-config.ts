import "server-only";

const boundedInteger = (value: string | undefined, fallback: number, maximum: number) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : fallback;
};

export const businessVerificationConfig = {
  provider:
    process.env.BUSINESS_REGISTRY_PROVIDER === "vietqr"
      ? ("vietqr" as const)
      : ("disabled" as const),
  providerTimeoutMs: boundedInteger(
    process.env.BUSINESS_REGISTRY_TIMEOUT_MS,
    4_000,
    6_000,
  ),
  providerResponseLimitBytes: boundedInteger(
    process.env.BUSINESS_REGISTRY_RESPONSE_LIMIT_BYTES,
    65_536,
    131_072,
  ),
  lookupLifetimeMs: 24 * 60 * 60_000,
  lookupCacheLifetimeMs: 15 * 60_000,
  preparationLifetimeMs: 48 * 60 * 60_000,
  challengeLifetimeMs: 24 * 60 * 60_000,
  sensitiveScrubDelayMs: 24 * 60 * 60_000,
  metadataRetentionMs: 30 * 24 * 60 * 60_000,
  normalizationVersion: "business-verification-v1",
  policyVersion: "business-verification-consent-v1",
  emailSignalVersion: "company-email-signals-v1",
} as const;
