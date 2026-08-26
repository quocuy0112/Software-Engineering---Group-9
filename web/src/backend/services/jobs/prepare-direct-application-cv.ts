import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createCvWorkerStorage } from "@/backend/cv/workers/cv-worker-resources";
import {
  CV_MAX_FILE_BYTES,
  validateCvFileBytes,
} from "@/shared/cv-file-validation";
import type { DirectApplicationCv } from "./application-policy";

export type DirectApplicationCvSource = Readonly<{
  fileName: string;
  mimeType: string;
  byteSize: number;
  source: AsyncIterable<Uint8Array>;
}>;

export type PreparedDirectApplicationCv = DirectApplicationCv & {
  cleanup(): Promise<void>;
};

function safeFileName(value: string) {
  const normalized = value
    .replace(/[\\/]/gu, "_")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .trim()
    .slice(0, 255);
  return normalized || "uploaded-cv";
}

export async function prepareDirectApplicationCv(
  input: DirectApplicationCvSource,
): Promise<PreparedDirectApplicationCv> {
  if (
    !Number.isSafeInteger(input.byteSize) ||
    input.byteSize < 1 ||
    input.byteSize > CV_MAX_FILE_BYTES
  ) {
    throw new Error("APPLICATION_CV_INELIGIBLE");
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  for await (const chunk of input.source) {
    const copy = Uint8Array.from(chunk);
    received += copy.byteLength;
    if (received > input.byteSize || received > CV_MAX_FILE_BYTES)
      throw new Error("APPLICATION_CV_INELIGIBLE");
    chunks.push(copy);
  }
  if (received !== input.byteSize) throw new Error("APPLICATION_CV_INELIGIBLE");
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const detected = validateCvFileBytes({
    bytes,
    fileName: input.fileName,
    declaredMimeType: input.mimeType,
  });

  const storage = createCvWorkerStorage();
  await storage.assertReady();
  const hash = createHash("sha256");
  const stored = await storage.put({
    expectedBytes: bytes.byteLength,
    source: (async function* () {
      hash.update(bytes);
      yield bytes;
    })(),
  });
  const fileName = safeFileName(input.fileName);
  const prepared = {
    id: "application-cv-" + randomUUID(),
    displayName: fileName,
    fileName,
    mimeType: detected.mimeType,
    byteSize: detected.byteSize,
    storageKey: stored.locator,
    checksumSha256: hash.digest("hex"),
    async cleanup() {
      await storage.delete(stored.locator);
    },
  } satisfies PreparedDirectApplicationCv;
  return Object.freeze(prepared);
}
