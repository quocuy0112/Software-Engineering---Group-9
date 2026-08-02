import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from "node:crypto";
import type { Writable } from "node:stream";

export type CvArtifactEncryptionContext = Readonly<{
  accountId: string;
  uploadId: string;
  artifactId: string;
  kind: "SOURCE_DOCUMENT" | "EXTRACTED_TEXT";
}>;

export type CvArtifactEnvelope = Readonly<{
  keyVersion: number;
  iv: Buffer;
  authenticationTag: Buffer;
  plaintextBytes: number;
  ciphertextBytes: number;
}>;

export class CvArtifactAuthenticationError extends Error {
  readonly name = "CvArtifactAuthenticationError";
  readonly code = "CV_ARTIFACT_AUTHENTICATION_FAILED";

  constructor() {
    super("CV_ARTIFACT_AUTHENTICATION_FAILED");
  }

  toJSON() {
    return { name: this.name, code: this.code };
  }
}

export class CvArtifactCryptorConfigurationError extends Error {
  readonly name = "CvArtifactCryptorConfigurationError";
  readonly code = "CV_ARTIFACT_KEY_CONFIGURATION_INVALID";

  constructor() {
    super("CV_ARTIFACT_KEY_CONFIGURATION_INVALID");
  }

  toJSON() {
    return { name: this.name, code: this.code };
  }
}

function aad(context: CvArtifactEncryptionContext, keyVersion: number): Buffer {
  const fields = [
    "smarthire-cv-artifact",
    "aes-256-gcm-v1",
    String(keyVersion),
    context.kind,
    context.accountId,
    context.uploadId,
    context.artifactId,
  ];
  return Buffer.from(
    fields
      .map((field) => `${Buffer.byteLength(field, "utf8")}:${field}`)
      .join("|"),
    "utf8",
  );
}

async function write(output: Writable, chunk: Buffer): Promise<void> {
  if (chunk.byteLength === 0) return;
  await new Promise<void>((resolve, reject) => {
    output.write(chunk, (error: Error | null | undefined) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function transformStream(
  source: AsyncIterable<Uint8Array>,
  destination: Writable,
  transform: CipherGCM | DecipherGCM,
): Promise<{ inputBytes: number; outputBytes: number }> {
  let inputBytes = 0;
  let outputBytes = 0;
  for await (const sourceChunk of source) {
    const temporary = Buffer.from(sourceChunk);
    inputBytes += temporary.byteLength;
    try {
      const transformed = transform.update(temporary);
      outputBytes += transformed.byteLength;
      await write(destination, transformed);
      // Writable callbacks signal acceptance, not that a downstream
      // PassThrough consumer has copied the chunk. The destination owns the
      // transformed buffer after write; clearing it here corrupts queued data.
    } finally {
      temporary.fill(0);
    }
  }
  const final = transform.final();
  outputBytes += final.byteLength;
  await write(destination, final);
  return { inputBytes, outputBytes };
}

export function createArtifactCryptor(input: {
  activeKeyVersion: number;
  keys: Readonly<Record<number, Uint8Array>>;
}) {
  if (
    !Number.isSafeInteger(input.activeKeyVersion) ||
    input.activeKeyVersion < 1
  ) {
    throw new CvArtifactCryptorConfigurationError();
  }
  const keys = new Map<number, Buffer>();
  for (const [rawVersion, rawKey] of Object.entries(input.keys)) {
    const version = Number(rawVersion);
    if (
      !Number.isSafeInteger(version) ||
      version < 1 ||
      rawKey.byteLength !== 32
    ) {
      for (const key of keys.values()) key.fill(0);
      throw new CvArtifactCryptorConfigurationError();
    }
    keys.set(version, Buffer.from(rawKey));
  }
  if (!keys.has(input.activeKeyVersion)) {
    for (const key of keys.values()) key.fill(0);
    throw new CvArtifactCryptorConfigurationError();
  }

  return Object.freeze({
    async encrypt(args: {
      plaintext: AsyncIterable<Uint8Array>;
      ciphertext: Writable;
      context: CvArtifactEncryptionContext;
    }): Promise<CvArtifactEnvelope> {
      const keyVersion = input.activeKeyVersion;
      const storedKey = keys.get(keyVersion);
      if (!storedKey) throw new CvArtifactCryptorConfigurationError();
      const key = Buffer.from(storedKey);
      const iv = randomBytes(12);
      const authenticatedData = aad(args.context, keyVersion);
      try {
        const cipher = createCipheriv("aes-256-gcm", key, iv);
        cipher.setAAD(authenticatedData);
        const counts = await transformStream(
          args.plaintext,
          args.ciphertext,
          cipher,
        );
        const authenticationTag = cipher.getAuthTag();
        return Object.freeze({
          keyVersion,
          iv: Buffer.from(iv),
          authenticationTag: Buffer.from(authenticationTag),
          plaintextBytes: counts.inputBytes,
          ciphertextBytes: counts.outputBytes,
        });
      } finally {
        key.fill(0);
        authenticatedData.fill(0);
      }
    },

    async decrypt(args: {
      ciphertext: AsyncIterable<Uint8Array>;
      plaintext: Writable;
      context: CvArtifactEncryptionContext;
      envelope: Pick<
        CvArtifactEnvelope,
        "keyVersion" | "iv" | "authenticationTag"
      >;
    }): Promise<Readonly<{ ciphertextBytes: number; plaintextBytes: number }>> {
      const storedKey = keys.get(args.envelope.keyVersion);
      if (
        !storedKey ||
        args.envelope.iv.byteLength !== 12 ||
        args.envelope.authenticationTag.byteLength !== 16
      ) {
        throw new CvArtifactAuthenticationError();
      }
      const key = Buffer.from(storedKey);
      const authenticatedData = aad(args.context, args.envelope.keyVersion);
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, args.envelope.iv);
        decipher.setAAD(authenticatedData);
        decipher.setAuthTag(args.envelope.authenticationTag);
        const counts = await transformStream(
          args.ciphertext,
          args.plaintext,
          decipher,
        );
        return Object.freeze({
          ciphertextBytes: counts.inputBytes,
          plaintextBytes: counts.outputBytes,
        });
      } catch {
        throw new CvArtifactAuthenticationError();
      } finally {
        key.fill(0);
        authenticatedData.fill(0);
      }
    },

    destroy(): void {
      for (const key of keys.values()) key.fill(0);
      keys.clear();
    },
  });
}
