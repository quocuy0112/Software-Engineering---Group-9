import "server-only";

import { createHash, randomUUID } from "node:crypto";
import {
  ApplicationDocumentStorageError,
  type ApplicationDocumentStoragePort,
} from "../storage/application-document-storage";

const MAX_BYTES = 5_000_000;
const allowedMediaTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export type PromotedApplicationDocument = Readonly<{
  promotionId: string;
  storageKey: string;
  storagePurposeVersion: "application-document-v1";
  fileName: string;
  mediaType: string;
  byteLength: number;
  checksumSha256: string;
  safetyAssessmentId: string;
}>;

function safeFileName(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\\/]/gu, "_")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .trim()
    .slice(0, 255);
  return normalized || "application-document";
}

export async function promoteApplicationDocument(input: {
  storage: ApplicationDocumentStoragePort;
  source: AsyncIterable<Uint8Array>;
  fileName: string;
  mediaType: string;
  byteLength: number;
}): Promise<PromotedApplicationDocument> {
  if (
    !Number.isSafeInteger(input.byteLength) ||
    input.byteLength < 1 ||
    input.byteLength > MAX_BYTES ||
    !allowedMediaTypes.has(input.mediaType)
  ) {
    throw new ApplicationDocumentStorageError("APPLICATION_STORAGE_INVALID");
  }
  await input.storage.assertReady();
  const digest = createHash("sha256");
  const stored = await input.storage.put({
    expectedBytes: input.byteLength,
    source: (async function* () {
      for await (const chunk of input.source) {
        const bytes = Buffer.from(chunk);
        digest.update(bytes);
        yield bytes;
      }
    })(),
  });
  return Object.freeze({
    promotionId: randomUUID(),
    storageKey: stored.locator,
    storagePurposeVersion: stored.storagePurposeVersion,
    fileName: safeFileName(input.fileName),
    mediaType: input.mediaType,
    byteLength: stored.bytes,
    checksumSha256: digest.digest("hex"),
    safetyAssessmentId: `application-safety-${randomUUID()}`,
  });
}

export async function deletePromotedApplicationDocument(input: {
  storage: ApplicationDocumentStoragePort;
  storageKey: string;
}) {
  return input.storage.delete(input.storageKey);
}
