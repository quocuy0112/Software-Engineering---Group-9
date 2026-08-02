import { PassThrough, Readable, Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { createArtifactCryptor } from "@/backend/cv/encryption/artifact-cryptor";
import { createMetadataCryptor } from "@/backend/cv/encryption/metadata-cryptor";

const key = Buffer.alloc(32, 7);
const context = {
  accountId: "account_fixture",
  uploadId: "upload_fixture",
  artifactId: "artifact_fixture",
  kind: "SOURCE_DOCUMENT" as const,
};

const chunks = (...values: string[]) =>
  Readable.from(values.map((value) => Buffer.from(value, "utf8")));

function collector() {
  const values: Buffer[] = [];
  return {
    writable: new Writable({
      write(chunk, _encoding, done) {
        values.push(Buffer.from(chunk));
        done();
      },
    }),
    bytes: () => Buffer.concat(values),
    chunkCount: () => values.length,
  };
}

describe("CV artifact AES-256-GCM encryption", () => {
  it("streams with random 12-byte IVs, 16-byte tags, and no whole-value log", async () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    const cryptor = createArtifactCryptor({
      activeKeyVersion: 1,
      keys: { 1: key },
    });
    const firstOutput = collector();
    const secondOutput = collector();
    try {
      const first = await cryptor.encrypt({
        plaintext: chunks("synthetic-", "streamed-", "content"),
        ciphertext: firstOutput.writable,
        context,
      });
      const second = await cryptor.encrypt({
        plaintext: chunks("synthetic-streamed-content"),
        ciphertext: secondOutput.writable,
        context,
      });
      expect(first.iv).toHaveLength(12);
      expect(first.authenticationTag).toHaveLength(16);
      expect(first.keyVersion).toBe(1);
      expect(first.iv.equals(second.iv)).toBe(false);
      expect(firstOutput.bytes().equals(secondOutput.bytes())).toBe(false);
      expect(firstOutput.chunkCount()).toBeGreaterThan(1);
      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("decrypts only with matching versioned purpose-bound AAD", async () => {
    const cryptor = createArtifactCryptor({
      activeKeyVersion: 1,
      keys: { 1: key },
    });
    const encrypted = collector();
    const envelope = await cryptor.encrypt({
      plaintext: chunks("fixture plaintext"),
      ciphertext: encrypted.writable,
      context,
    });
    const decrypted = collector();
    await cryptor.decrypt({
      ciphertext: Readable.from([encrypted.bytes()]),
      plaintext: decrypted.writable,
      context,
      envelope,
    });
    expect(decrypted.bytes().toString("utf8")).toBe("fixture plaintext");

    await expect(
      cryptor.decrypt({
        ciphertext: Readable.from([encrypted.bytes()]),
        plaintext: collector().writable,
        context: { ...context, artifactId: "other-artifact" },
        envelope,
      }),
    ).rejects.toMatchObject({ code: "CV_ARTIFACT_AUTHENTICATION_FAILED" });
  });

  it("does not clear chunks still owned by an asynchronous PassThrough consumer", async () => {
    const cryptor = createArtifactCryptor({
      activeKeyVersion: 1,
      keys: { 1: key },
    });
    const encryptedStream = new PassThrough();
    const encryptedChunks: Buffer[] = [];
    const consumeEncrypted = (async () => {
      for await (const chunk of encryptedStream) {
        await Promise.resolve();
        encryptedChunks.push(Buffer.from(chunk));
      }
    })();
    const envelope = await cryptor.encrypt({
      plaintext: chunks("cross-", "process-", "artifact"),
      ciphertext: encryptedStream,
      context,
    });
    encryptedStream.end();
    await consumeEncrypted;

    const plaintextStream = new PassThrough();
    const plaintextChunks: Buffer[] = [];
    const consumePlaintext = (async () => {
      for await (const chunk of plaintextStream) {
        await Promise.resolve();
        plaintextChunks.push(Buffer.from(chunk));
      }
    })();
    await cryptor.decrypt({
      ciphertext: Readable.from([Buffer.concat(encryptedChunks)]),
      plaintext: plaintextStream,
      context,
      envelope,
    });
    plaintextStream.end();
    await consumePlaintext;
    expect(Buffer.concat(plaintextChunks).toString("utf8")).toBe(
      "cross-process-artifact",
    );
  });

  it("rejects ciphertext/tag tampering without serializing plaintext or secrets", async () => {
    const cryptor = createArtifactCryptor({
      activeKeyVersion: 1,
      keys: { 1: key },
    });
    const encrypted = collector();
    const envelope = await cryptor.encrypt({
      plaintext: chunks("canary plaintext that must never enter an error"),
      ciphertext: encrypted.writable,
      context,
    });
    const tampered = Buffer.from(encrypted.bytes());
    tampered[0] ^= 1;
    let caught: unknown;
    try {
      await cryptor.decrypt({
        ciphertext: Readable.from([tampered]),
        plaintext: collector().writable,
        context,
        envelope,
      });
    } catch (error) {
      caught = error;
    }
    expect(JSON.stringify(caught)).not.toContain("canary plaintext");
    expect(JSON.stringify(caught)).not.toContain(key.toString("base64"));
  });

  it("encrypts display filenames separately with a distinct purpose", () => {
    const metadata = createMetadataCryptor({
      activeKeyVersion: 1,
      keys: { 1: key },
    });
    const encrypted = metadata.encryptDisplayFilename("synthetic-cv.pdf", {
      accountId: context.accountId,
      uploadId: context.uploadId,
    });
    expect(encrypted).not.toContain("synthetic-cv.pdf");
    expect(
      metadata.decryptDisplayFilename(encrypted, {
        accountId: context.accountId,
        uploadId: context.uploadId,
      }),
    ).toBe("synthetic-cv.pdf");
    expect(() =>
      metadata.decryptDisplayFilename(encrypted, {
        accountId: context.accountId,
        uploadId: "other-upload",
      }),
    ).toThrow("CV_METADATA_AUTHENTICATION_FAILED");
  });
});
