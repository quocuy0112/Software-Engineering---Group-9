import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import "server-only";
import { prisma } from "../src/backend/database/prisma";
import { createApplicationDocumentStorage } from "../src/backend/applications/storage/factory";
import { createCvWorkerCryptor, createCvWorkerIntegrityReader, createCvWorkerStorage } from "../src/backend/cv/workers/cv-worker-resources";

const destination = createApplicationDocumentStorage();
const source = createCvWorkerStorage();
const sourceFile = (() => {
  const index = process.argv.indexOf("--source-file");
  return index >= 0 ? process.argv[index + 1] ?? null : null;
})();
let sourceFileBytes: Buffer | null = null;
let sourceFileSha256: string | null = null;
async function main() {
await destination.assertReady();
await source.assertReady();
if (sourceFile) {
  sourceFileBytes = await readFile(sourceFile);
  sourceFileSha256 = createHash("sha256").update(sourceFileBytes).digest("hex");
}
const documents = await prisma.applicationDocument.findMany({ where: { kind: "CV", deletedAt: null, sourceCandidateCvId: { not: null } }, select: { id: true, storageKeyEncrypted: true, byteLength: true, contentDigestHmac: true, sourceCandidateCvId: true, application: { select: { candidateUserId: true } } } });
let repaired = 0;
for (const document of documents) {
  let available = false;
  try {
    for await (const chunk of destination.open(document.storageKeyEncrypted, document.byteLength)) {
      available = chunk.byteLength >= 0;
      break;
    }
  } catch {
    available = false;
  }
  if (available) continue;
  const peer = documents.find((candidate) => candidate.id !== document.id && candidate.contentDigestHmac === document.contentDigestHmac);
  if (peer) {
    try {
      const stored = await destination.put({ source: destination.open(peer.storageKeyEncrypted, peer.byteLength), expectedBytes: peer.byteLength });
      await prisma.applicationDocument.update({ where: { id: document.id }, data: { storageKeyEncrypted: stored.locator, byteLength: stored.bytes } });
      document.storageKeyEncrypted = stored.locator;
      repaired++;
      continue;
    } catch {
      // Fall through to the encrypted source artifact recovery path.
    }
  }
  if (sourceFileBytes && sourceFileSha256 && document.contentDigestHmac?.toLowerCase() === sourceFileSha256 && document.byteLength === sourceFileBytes.byteLength) {
    try {
      const stored = await destination.put({ source: (async function* () { yield Uint8Array.from(sourceFileBytes!); })(), expectedBytes: sourceFileBytes.byteLength });
      await prisma.applicationDocument.update({ where: { id: document.id }, data: { storageKeyEncrypted: stored.locator, byteLength: stored.bytes } });
      document.storageKeyEncrypted = stored.locator;
      repaired++;
      continue;
    } catch {
      // Fall through to encrypted source-artifact recovery.
    }
  }
  const cvId = document.sourceCandidateCvId;
  const sourceCv = cvId ? await prisma.candidateCv.findUnique({ where: { id: cvId }, select: { storageKey: true } }) : null;
  const bridgeId = sourceCv?.storageKey ?? cvId;
  const uploadId = bridgeId?.startsWith("candidate-cv-") ? bridgeId.slice("candidate-cv-".length) : null;
  if (!uploadId) continue;
  const rows = await prisma.$queryRaw<Array<{ id: string; storageLocator: string; encryptionKeyVersion: number; encryptionIvHex: string; authenticationTagHex: string; plaintextBytes: number; ciphertextBytes: number; plaintextSha256Hex: string }>>`
    SELECT artifact."id", artifact."storageLocator", artifact."encryptionKeyVersion", encode(artifact."encryptionIv", 'hex') AS "encryptionIvHex", encode(artifact."authenticationTag", 'hex') AS "authenticationTagHex", artifact."plaintextBytes", artifact."ciphertextBytes", encode(artifact."plaintextSha256", 'hex') AS "plaintextSha256Hex"
      FROM "CvStoredArtifact" artifact WHERE artifact."uploadId" = ${uploadId} AND artifact."accountId" = ${document.application.candidateUserId} AND artifact."kind" = 'SOURCE_DOCUMENT' AND artifact."status" = 'AVAILABLE' AND artifact."deletedAt" IS NULL ORDER BY artifact."availableAt" DESC NULLS LAST LIMIT 1`;
  const artifact = rows[0];
  if (!artifact) continue;
  const verified = await createCvWorkerIntegrityReader(source, createCvWorkerCryptor()).verify({ locator: artifact.storageLocator, ciphertextBytes: artifact.ciphertextBytes, plaintextBytes: artifact.plaintextBytes, plaintextSha256: Buffer.from(artifact.plaintextSha256Hex, "hex"), context: { accountId: document.application.candidateUserId, uploadId, artifactId: artifact.id, kind: "SOURCE_DOCUMENT" }, envelope: { keyVersion: artifact.encryptionKeyVersion, iv: Buffer.from(artifact.encryptionIvHex, "hex"), authenticationTag: Buffer.from(artifact.authenticationTagHex, "hex") } });
  try {
    const stored = await destination.put({ source: verified.open(), expectedBytes: verified.plaintextBytes });
    await prisma.applicationDocument.update({ where: { id: document.id }, data: { storageKeyEncrypted: stored.locator, byteLength: stored.bytes, contentDigestHmac: verified.sha256 } });
    document.storageKeyEncrypted = stored.locator;
    repaired++;
  } finally { await verified.dispose(); }
}
console.log(JSON.stringify({ inspected: documents.length, repaired }));
await prisma.$disconnect();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
