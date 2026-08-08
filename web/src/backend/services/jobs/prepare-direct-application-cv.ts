import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createCvWorkerStorage } from "@/backend/cv/workers/cv-worker-resources";
import type { DirectApplicationCv } from "./application-policy";

const MAX_APPLICATION_CV_BYTES = 5_000_000;

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
    input.byteSize > MAX_APPLICATION_CV_BYTES
  ) {
    throw new Error("APPLICATION_CV_INELIGIBLE");
  }

  const storage = createCvWorkerStorage();
  await storage.assertReady();
  const hash = createHash("sha256");
  const stored = await storage.put({
    expectedBytes: input.byteSize,
    source: (async function* () {
      for await (const chunk of input.source) {
        const bytes = Buffer.from(chunk);
        hash.update(bytes);
        yield bytes;
      }
    })(),
  });
  const fileName = safeFileName(input.fileName);
  const prepared = {
    id: "application-cv-" + randomUUID(),
    displayName: fileName,
    fileName,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    storageKey: stored.locator,
    checksumSha256: hash.digest("hex"),
    async cleanup() {
      await storage.delete(stored.locator);
    },
  } satisfies PreparedDirectApplicationCv;
  return Object.freeze(prepared);
}
