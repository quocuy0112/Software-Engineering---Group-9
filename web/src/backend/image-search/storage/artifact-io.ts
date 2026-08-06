import "server-only";

import { createHash } from "node:crypto";

import type { PrivateSearchArtifactStorage } from "./private-search-storage";
import type {
  SearchArtifactLocator,
  SearchStorageContext,
} from "./private-search-storage";

export async function readSearchArtifact(input: {
  storage: PrivateSearchArtifactStorage;
  locator: string | null;
  authenticationTag: Uint8Array | null;
  context: SearchStorageContext;
  expectedBytes: number;
  expectedSha256: Uint8Array;
  maximumBytes: number;
}) {
  if (!input.locator || !input.authenticationTag)
    throw new Error("SEARCH_ARTIFACT_INACCESSIBLE");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of input.storage.open({
    locator: input.locator as SearchArtifactLocator,
    context: input.context,
    authenticationTag: input.authenticationTag,
  })) {
    total += chunk.byteLength;
    if (total > input.maximumBytes)
      throw new Error("SEARCH_ARTIFACT_OVERSIZED");
    chunks.push(Buffer.from(chunk));
  }
  const bytes = Buffer.concat(chunks, total);
  if (
    bytes.byteLength !== input.expectedBytes ||
    !createHash("sha256")
      .update(bytes)
      .digest()
      .equals(Buffer.from(input.expectedSha256))
  )
    throw new Error("SEARCH_ARTIFACT_INTEGRITY_FAILED");
  return bytes;
}

export async function* oneChunk(bytes: Uint8Array) {
  yield bytes;
}
