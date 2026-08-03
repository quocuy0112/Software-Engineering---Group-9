import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type CvFilenameContext = Readonly<{
  accountId: string;
  uploadId: string;
}>;

export class CvMetadataAuthenticationError extends Error {
  readonly name = "CvMetadataAuthenticationError";
  readonly code = "CV_METADATA_AUTHENTICATION_FAILED";

  constructor() {
    super("CV_METADATA_AUTHENTICATION_FAILED");
  }

  toJSON() {
    return { name: this.name, code: this.code };
  }
}

function aad(context: CvFilenameContext, keyVersion: number): Buffer {
  const fields = [
    "smarthire-cv-display-filename",
    "aes-256-gcm-v1",
    String(keyVersion),
    context.accountId,
    context.uploadId,
  ];
  return Buffer.from(
    fields
      .map((field) => `${Buffer.byteLength(field, "utf8")}:${field}`)
      .join("|"),
    "utf8",
  );
}

type MetadataEnvelope = Readonly<{
  v: 1;
  k: number;
  i: string;
  t: string;
  c: string;
}>;

export function createMetadataCryptor(input: {
  activeKeyVersion: number;
  keys: Readonly<Record<number, Uint8Array>>;
}) {
  const keys = new Map<number, Buffer>();
  for (const [rawVersion, rawKey] of Object.entries(input.keys)) {
    const version = Number(rawVersion);
    if (
      !Number.isSafeInteger(version) ||
      version < 1 ||
      rawKey.byteLength !== 32
    ) {
      for (const key of keys.values()) key.fill(0);
      throw new Error("CV_METADATA_KEY_CONFIGURATION_INVALID");
    }
    keys.set(version, Buffer.from(rawKey));
  }
  if (!keys.has(input.activeKeyVersion)) {
    for (const key of keys.values()) key.fill(0);
    throw new Error("CV_METADATA_KEY_CONFIGURATION_INVALID");
  }

  return Object.freeze({
    encryptDisplayFilename(
      filename: string,
      context: CvFilenameContext,
    ): string {
      const storedKey = keys.get(input.activeKeyVersion);
      if (!storedKey) throw new Error("CV_METADATA_KEY_CONFIGURATION_INVALID");
      const key = Buffer.from(storedKey);
      const iv = randomBytes(12);
      const authenticatedData = aad(context, input.activeKeyVersion);
      const plaintext = Buffer.from(filename, "utf8");
      try {
        const cipher = createCipheriv("aes-256-gcm", key, iv);
        cipher.setAAD(authenticatedData);
        const ciphertext = Buffer.concat([
          cipher.update(plaintext),
          cipher.final(),
        ]);
        const envelope: MetadataEnvelope = {
          v: 1,
          k: input.activeKeyVersion,
          i: iv.toString("base64url"),
          t: cipher.getAuthTag().toString("base64url"),
          c: ciphertext.toString("base64url"),
        };
        ciphertext.fill(0);
        return Buffer.from(JSON.stringify(envelope), "utf8").toString(
          "base64url",
        );
      } finally {
        plaintext.fill(0);
        key.fill(0);
        authenticatedData.fill(0);
      }
    },

    decryptDisplayFilename(
      encrypted: string,
      context: CvFilenameContext,
    ): string {
      let envelope: MetadataEnvelope;
      try {
        const parsed: unknown = JSON.parse(
          Buffer.from(encrypted, "base64url").toString("utf8"),
        );
        if (
          !parsed ||
          typeof parsed !== "object" ||
          Object.keys(parsed).sort().join(",") !== "c,i,k,t,v" ||
          (parsed as MetadataEnvelope).v !== 1 ||
          !Number.isSafeInteger((parsed as MetadataEnvelope).k)
        ) {
          throw new Error("invalid envelope");
        }
        envelope = parsed as MetadataEnvelope;
      } catch {
        throw new CvMetadataAuthenticationError();
      }
      const storedKey = keys.get(envelope.k);
      if (!storedKey) throw new CvMetadataAuthenticationError();
      const key = Buffer.from(storedKey);
      const iv = Buffer.from(envelope.i, "base64url");
      const tag = Buffer.from(envelope.t, "base64url");
      const ciphertext = Buffer.from(envelope.c, "base64url");
      const authenticatedData = aad(context, envelope.k);
      try {
        if (iv.byteLength !== 12 || tag.byteLength !== 16) {
          throw new Error("invalid envelope");
        }
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAAD(authenticatedData);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);
        try {
          return plaintext.toString("utf8");
        } finally {
          plaintext.fill(0);
        }
      } catch {
        throw new CvMetadataAuthenticationError();
      } finally {
        key.fill(0);
        iv.fill(0);
        tag.fill(0);
        ciphertext.fill(0);
        authenticatedData.fill(0);
      }
    },

    destroy(): void {
      for (const key of keys.values()) key.fill(0);
      keys.clear();
    },
  });
}
