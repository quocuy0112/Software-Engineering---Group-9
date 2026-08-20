import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("SMARTHIRE-EXPORT-1\n", "utf8");

export function exportEncryptionKey() {
  const configured = process.env.ANALYTICS_EXPORT_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length === 32) return key;
    throw new Error("ANALYTICS_EXPORT_ENCRYPTION_KEY_INVALID");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("ANALYTICS_EXPORT_ENCRYPTION_KEY_REQUIRED");
  }
  return createHash("sha256").update("smarthire-development-export-key").digest();
}

export function checksum(content: Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

export function sealExport(content: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", exportEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(content), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, ciphertext]);
}

export function openExport(envelope: Buffer) {
  const offset = MAGIC.length;
  if (
    envelope.length < offset + 12 + 16 ||
    !envelope.subarray(0, offset).equals(MAGIC)
  ) {
    throw new Error("EXPORT_ARTIFACT_INVALID");
  }
  const iv = envelope.subarray(offset, offset + 12);
  const tag = envelope.subarray(offset + 12, offset + 28);
  const ciphertext = envelope.subarray(offset + 28);
  const decipher = createDecipheriv("aes-256-gcm", exportEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
