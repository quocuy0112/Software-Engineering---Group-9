import "server-only";

import { configuredOrigins } from "@/backend/admin/origins";

function normalizeHost(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes(",") || /\s/u.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function isCandidateHost(
  host: string | null | undefined,
  candidateOrigin?: string,
) {
  let expectedOrigin = candidateOrigin;
  if (!expectedOrigin) {
    try {
      expectedOrigin = configuredOrigins().candidate;
    } catch {
      return false;
    }
  }
  if (!host || !expectedOrigin) return false;
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return false;
  try {
    const expectedHost = normalizeHost(new URL(expectedOrigin).host);
    return expectedHost !== null && normalizedHost === expectedHost;
  } catch {
    return false;
  }
}

export function isCandidateRequestHost(headers: Headers) {
  return isCandidateHost(headers.get("host"));
}
