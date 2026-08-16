import "server-only";

import type { StructuredDocumentPreview } from "@/shared/contracts/applications/document-preview";

const MAX_ENTRIES = 128;
const TTL_MS = 30 * 60_000;

type CachedPreview = Omit<
  StructuredDocumentPreview,
  "cacheHit" | "processingMilliseconds"
> & {
  cachedAt: number;
};

const cache = new Map<string, CachedPreview>();

function evictExpired(now: number) {
  for (const [key, value] of cache) {
    if (now - value.cachedAt > TTL_MS) cache.delete(key);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (!oldest) return;
    cache.delete(oldest);
  }
}

export function getCachedDocumentPreview(
  key: string,
): StructuredDocumentPreview | null {
  const now = Date.now();
  evictExpired(now);
  const value = cache.get(key);
  if (!value) return null;
  cache.delete(key);
  cache.set(key, value);
  return {
    ...value,
    processingMilliseconds: 0,
    cacheHit: true,
  };
}

export function setCachedDocumentPreview(
  key: string,
  value: StructuredDocumentPreview,
) {
  const now = Date.now();
  cache.delete(key);
  cache.set(key, {
    ...value,
    cachedAt: now,
  });
  evictExpired(now);
}

export function clearCachedDocumentPreviews(applicationId?: string) {
  if (!applicationId) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${applicationId}:`)) cache.delete(key);
  }
}
