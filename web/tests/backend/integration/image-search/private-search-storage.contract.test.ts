import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FilesystemPrivateSearchArtifactStorage } from "@/backend/image-search/storage/filesystem";
import type {
  PrivateSearchArtifactStorage,
  SearchStorageContext,
} from "@/backend/image-search/storage/private-search-storage";
import { S3PrivateSearchArtifactStorage } from "@/backend/image-search/storage/s3";

const plaintext = Buffer.from("synthetic OCR text: Kỹ sư phần mềm", "utf8");
const context: SearchStorageContext = {
  queryId: "query_fixture_001",
  artifactId: "artifact_fixture_001",
  kind: "OCR_TEXT",
};
const keyring = {
  activeKeyVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 0x41)]]),
};

async function collect(source: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of source) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function bodyBytes(body: unknown): Promise<Buffer> {
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body && Symbol.asyncIterator in Object(body)) {
    return collect(body as AsyncIterable<Uint8Array>);
  }
  throw new Error("unsupported fake body");
}

class FakeS3Client {
  objects = new Map<string, Buffer>();
  commands: Array<{ name: string; input: Record<string, unknown> }> = [];

  async send(command: {
    input: Record<string, unknown>;
    constructor: { name: string };
  }) {
    const name = command.constructor.name;
    const input = command.input;
    this.commands.push({ name, input });
    const key = String(input.Key ?? "");
    if (name === "HeadBucketCommand") return {};
    if (name === "PutObjectCommand") {
      this.objects.set(key, await bodyBytes(input.Body));
      return {};
    }
    if (name === "GetObjectCommand") {
      const value = this.objects.get(key);
      if (!value)
        throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
      return { Body: Readable.from([value]), ContentLength: value.length };
    }
    if (name === "DeleteObjectCommand") {
      this.objects.delete(key);
      return {};
    }
    throw new Error(`unexpected command ${name}`);
  }
}

let root = "";
let fakeS3: FakeS3Client;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "smarthire-search-storage-"));
  fakeS3 = new FakeS3Client();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function adapters(): Array<{
  name: string;
  storage: PrivateSearchArtifactStorage;
}> {
  return [
    {
      name: "filesystem",
      storage: new FilesystemPrivateSearchArtifactStorage({ root, keyring }),
    },
    {
      name: "s3",
      storage: new S3PrivateSearchArtifactStorage({
        client: fakeS3,
        bucket: "private-fixture-bucket",
        region: "ap-southeast-1",
        prefix: "image-search/",
        kmsKeyId: "fixture-kms-key",
        keyring,
      }),
    },
  ];
}

describe("PrivateSearchArtifactStorage contract", () => {
  it.each(["filesystem", "s3"])(
    "%s encrypts at rest and round-trips only under the exact purpose/query context",
    async (name) => {
      const storage = adapters().find((item) => item.name === name)!.storage;
      await storage.assertReady();
      const stored = await storage.put({
        source: Readable.from([plaintext]),
        expectedBytes: plaintext.length,
        context,
      });
      expect(stored.locator).not.toMatch(
        /query_fixture|artifact_fixture|OCR_TEXT/u,
      );
      expect(stored.plaintextBytes).toBe(plaintext.length);
      expect(
        await collect(storage.open({ locator: stored.locator, context })),
      ).toEqual(plaintext);
      await expect(
        collect(
          storage.open({
            locator: stored.locator,
            context: { ...context, queryId: "other-query" },
          }),
        ),
      ).rejects.toMatchObject({ code: "SEARCH_STORAGE_CONTEXT_MISMATCH" });

      const ciphertext =
        name === "filesystem"
          ? await readFile(join(root, String(stored.locator)))
          : [...fakeS3.objects.values()][0];
      expect(ciphertext).not.toContain(plaintext);
    },
  );

  it.each(["filesystem", "s3"])(
    "%s rejects tampering and treats repeated deletion as success",
    async (name) => {
      const storage = adapters().find((item) => item.name === name)!.storage;
      const stored = await storage.put({
        source: Readable.from([plaintext]),
        expectedBytes: plaintext.length,
        context,
      });
      await expect(
        collect(
          storage.open({
            locator: stored.locator,
            context,
            authenticationTag: Buffer.alloc(16),
          }),
        ),
      ).rejects.toMatchObject({ code: "SEARCH_STORAGE_INTEGRITY_FAILED" });
      await expect(storage.delete(stored.locator)).resolves.toBe("DELETED");
      await expect(storage.delete(stored.locator)).resolves.toBe(
        "ALREADY_ABSENT",
      );
    },
  );

  it("uses conditional private SSE-KMS writes without an ACL", async () => {
    const storage = adapters().find((item) => item.name === "s3")!.storage;
    await storage.put({
      source: Readable.from([plaintext]),
      expectedBytes: plaintext.length,
      context,
    });
    const put = fakeS3.commands.find(
      (item) => item.name === "PutObjectCommand",
    )!;
    expect(put.input).toMatchObject({
      IfNoneMatch: "*",
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: "fixture-kms-key",
      BucketKeyEnabled: true,
    });
    expect(put.input).not.toHaveProperty("ACL");
  });
});
