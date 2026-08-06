import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";

import {
  collectExact,
  openSearchEnvelope,
  sealSearchArtifact,
  type SearchArtifactLocator,
} from "@/backend/image-search/storage/private-search-storage";
import { FilesystemPrivateSearchArtifactStorage } from "@/backend/image-search/storage/filesystem";
import { verifyVisitorCapability } from "@/backend/security/image-search-request-boundary";

const context = {
  queryId: "query_security_fixture",
  artifactId: "artifact_security_fixture",
  kind: "OCR_TEXT" as const,
};
const searchKey = Buffer.alloc(32, 0x51);
const keyring = { activeKeyVersion: 1, keys: new Map([[1, searchKey]]) };

describe("OCR storage and capability security", () => {
  it("rejects ciphertext tampering plus key, purpose, query, and artifact crossover", () => {
    const sealed = sealSearchArtifact(
      Buffer.from("synthetic private text"),
      context,
      keyring,
    );
    const locator =
      "00000000-0000-4000-8000-000000000005.bin" as SearchArtifactLocator;
    const exact = { locator, context };
    expect(openSearchEnvelope(sealed.envelope, exact, keyring).toString()).toBe(
      "synthetic private text",
    );

    const tampered = Buffer.from(sealed.envelope);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => openSearchEnvelope(tampered, exact, keyring)).toThrowError(
      expect.objectContaining({ code: "SEARCH_STORAGE_INTEGRITY_FAILED" }),
    );
    expect(() =>
      openSearchEnvelope(sealed.envelope, exact, {
        activeKeyVersion: 1,
        keys: new Map([[1, Buffer.alloc(32, 0x52)]]),
      }),
    ).toThrowError(
      expect.objectContaining({ code: "SEARCH_STORAGE_CONTEXT_MISMATCH" }),
    );
    for (const crossed of [
      { ...context, queryId: "other-query" },
      { ...context, artifactId: "other-artifact" },
      { ...context, kind: "VALIDATED_INTENT" as const },
    ])
      expect(() =>
        openSearchEnvelope(
          sealed.envelope,
          { locator, context: crossed },
          keyring,
        ),
      ).toThrowError(
        expect.objectContaining({ code: "SEARCH_STORAGE_CONTEXT_MISMATCH" }),
      );
  });

  it("rejects content-length attacks and guessed/traversal locators before file access", async () => {
    await expect(
      collectExact(Readable.from([Buffer.from("1234")]), 3),
    ).rejects.toMatchObject({
      code: "SEARCH_STORAGE_LENGTH_MISMATCH",
    });
    await expect(
      collectExact(Readable.from([Buffer.from("12")]), 3),
    ).rejects.toMatchObject({
      code: "SEARCH_STORAGE_LENGTH_MISMATCH",
    });
    const storage = new FilesystemPrivateSearchArtifactStorage({
      root: ".local/unused",
      keyring,
    });
    const iterable = storage.open({
      locator: "../guess.bin" as SearchArtifactLocator,
      context,
    });
    const iterator = iterable[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toMatchObject({
      code: "SEARCH_STORAGE_LOCATOR_INVALID",
    });
  });

  it("uses constant-shape HMAC capability verification and a group-private OCR socket", async () => {
    const capability = Buffer.alloc(32, 0x61).toString("base64url");
    const capabilityKey = Buffer.alloc(32, 0x62);
    const { createHmac } = await import("node:crypto");
    const expectedDigest = createHmac("sha256", capabilityKey)
      .update(`image-search-capability-v1:query:${capability}`, "utf8")
      .digest();
    expect(
      verifyVisitorCapability({
        queryId: "query",
        capability,
        expectedDigest,
        capabilityHmacKey: capabilityKey,
      }),
    ).toBe(true);
    expect(
      verifyVisitorCapability({
        queryId: "other",
        capability,
        expectedDigest,
        capabilityHmacKey: capabilityKey,
      }),
    ).toBe(false);
    const app = await readFile("../ocr-engine/src/app.py", "utf8");
    expect(app).toContain("os.umask(0o007)");
  });
});
