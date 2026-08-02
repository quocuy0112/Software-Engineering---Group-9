import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrivateCvStorage } from "@/backend/cv/storage/private-cv-storage";
import { FilesystemPrivateCvStorage } from "@/backend/cv/storage/filesystem";
import { S3PrivateCvStorage } from "@/backend/cv/storage/s3";

const bytes = Buffer.from("synthetic encrypted artifact", "utf8");

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
  throw new Error("unsupported fixture S3 body");
}

class FakeS3Client {
  readonly objects = new Map<string, Buffer>();
  readonly commands: Array<{ name: string; input: Record<string, unknown> }> =
    [];

  async send(command: {
    input: Record<string, unknown>;
    constructor: { name: string };
  }) {
    const name = command.constructor.name;
    const input = command.input;
    this.commands.push({ name, input });
    if (name === "GetPublicAccessBlockCommand") {
      return {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true,
        },
      };
    }
    if (name === "GetBucketPolicyStatusCommand") {
      return { PolicyStatus: { IsPublic: false } };
    }
    if (name === "GetBucketVersioningCommand") return {};
    if (name === "GetBucketEncryptionCommand") {
      return {
        ServerSideEncryptionConfiguration: {
          Rules: [
            {
              ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: "aws:kms",
                KMSMasterKeyID: "fixture-kms-key",
              },
              BucketKeyEnabled: true,
            },
          ],
        },
      };
    }
    if (name === "GetBucketLifecycleConfigurationCommand") {
      return {
        Rules: [
          {
            Status: "Enabled",
            Filter: { Prefix: "cv-artifacts/" },
            Expiration: { Days: 31 },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
          },
        ],
      };
    }
    const key = String(input.Key ?? "");
    if (name === "PutObjectCommand") {
      if (input.IfNoneMatch !== "*")
        throw new Error("fixture requires no-overwrite");
      if (this.objects.has(key)) {
        const error = new Error("precondition failed");
        Object.assign(error, {
          name: "PreconditionFailed",
          $metadata: { httpStatusCode: 412 },
        });
        throw error;
      }
      this.objects.set(key, await bodyBytes(input.Body));
      return { ETag: '"fixture"' };
    }
    if (name === "GetObjectCommand") {
      const value = this.objects.get(key);
      if (!value)
        throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
      return { Body: Readable.from([value]), ContentLength: value.byteLength };
    }
    if (name === "HeadObjectCommand") {
      const value = this.objects.get(key);
      if (!value)
        throw Object.assign(new Error("missing"), { name: "NotFound" });
      return { ContentLength: value.byteLength };
    }
    if (name === "DeleteObjectCommand") {
      this.objects.delete(key);
      return {};
    }
    if (name === "ListObjectsV2Command") {
      const all = [...this.objects.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      );
      const start = input.ContinuationToken
        ? Number(input.ContinuationToken)
        : 0;
      const maximum = Number(input.MaxKeys ?? 1000);
      const page = all.slice(start, start + maximum);
      return {
        Contents: page.map(([Key, value]) => ({
          Key,
          Size: value.byteLength,
          LastModified: new Date("2026-08-01T00:00:00.000Z"),
        })),
        IsTruncated: start + maximum < all.length,
        NextContinuationToken:
          start + maximum < all.length ? String(start + maximum) : undefined,
      };
    }
    throw new Error(`unexpected fake S3 command ${name}`);
  }
}

let root = "";
let outside = "";
let fakeS3: FakeS3Client;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "smarthire-cv-storage-"));
  outside = await mkdtemp(join(tmpdir(), "smarthire-cv-outside-"));
  fakeS3 = new FakeS3Client();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

function adapters(): Array<{
  name: string;
  create: () => PrivateCvStorage;
}> {
  return [
    {
      name: "filesystem",
      create: () => new FilesystemPrivateCvStorage({ root }),
    },
    {
      name: "s3",
      create: () =>
        new S3PrivateCvStorage({
          client: fakeS3,
          bucket: "fixture-private-bucket",
          region: "fixture-region-1",
          kmsKeyId: "fixture-kms-key",
          prefix: "cv-artifacts",
        }),
    },
  ];
}

describe("PrivateCvStorage adapter contract", () => {
  it.each(["filesystem", "s3"])(
    "%s writes atomically to random private locators and reads exact lengths",
    async (name) => {
      const storage = adapters()
        .find((adapter) => adapter.name === name)!
        .create();
      await storage.assertReady();
      const first = await storage.put({
        source: Readable.from([bytes.subarray(0, 8), bytes.subarray(8)]),
        expectedBytes: bytes.byteLength,
      });
      const second = await storage.put({
        source: Readable.from([bytes]),
        expectedBytes: bytes.byteLength,
      });
      expect(first.locator).not.toBe(second.locator);
      expect(first.locator).not.toMatch(/synthetic|candidate|upload/u);
      expect(
        await collect(storage.open(first.locator, bytes.byteLength)),
      ).toEqual(bytes);
      await expect(
        collect(storage.open(first.locator, bytes.byteLength + 1)),
      ).rejects.toMatchObject({ code: "CV_STORAGE_LENGTH_MISMATCH" });
      expect("publicUrl" in storage).toBe(false);
      expect("downloadUrl" in storage).toBe(false);
    },
  );

  it.each(["filesystem", "s3"])(
    "%s deletion is idempotent and inventory is paginated",
    async (name) => {
      const storage = adapters()
        .find((adapter) => adapter.name === name)!
        .create();
      await storage.assertReady();
      const records = [];
      for (let index = 0; index < 3; index += 1) {
        records.push(
          await storage.put({
            source: Readable.from([bytes]),
            expectedBytes: bytes.byteLength,
          }),
        );
      }
      const firstPage = await storage.inventory({ limit: 2 });
      const secondPage = await storage.inventory({
        limit: 2,
        cursor: firstPage.nextCursor,
      });
      expect(firstPage.items).toHaveLength(2);
      expect(secondPage.items).toHaveLength(1);
      expect(
        new Set(
          [...firstPage.items, ...secondPage.items].map((item) => item.locator),
        ).size,
      ).toBe(3);
      await expect(storage.delete(records[0].locator)).resolves.toEqual({
        deleted: true,
      });
      await expect(storage.delete(records[0].locator)).resolves.toEqual({
        deleted: false,
      });
    },
  );

  it("rejects filesystem traversal and symlink/junction escape", async () => {
    const storage = new FilesystemPrivateCvStorage({ root });
    await storage.assertReady();
    await expect(collect(storage.open("../outside", 1))).rejects.toMatchObject({
      code: "CV_STORAGE_LOCATOR_INVALID",
    });
    await mkdir(join(outside, "target"));
    await symlink(
      join(outside, "target"),
      join(root, "fixture-link"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await expect(
      collect(storage.open("fixture-link/object", 1)),
    ).rejects.toMatchObject({ code: "CV_STORAGE_LOCATOR_INVALID" });
  });

  it("uses S3 conditional put, SSE-KMS, no ACL, and private non-versioned policy", async () => {
    const storage = new S3PrivateCvStorage({
      client: fakeS3,
      bucket: "fixture-private-bucket",
      region: "fixture-region-1",
      kmsKeyId: "fixture-kms-key",
      prefix: "cv-artifacts",
      locatorFactory: () => "fixed-random-locator",
    });
    await storage.assertReady();
    await storage.put({
      source: Readable.from([bytes]),
      expectedBytes: bytes.byteLength,
    });
    await expect(
      storage.put({
        source: Readable.from([bytes]),
        expectedBytes: bytes.byteLength,
      }),
    ).rejects.toMatchObject({ code: "CV_STORAGE_OBJECT_EXISTS" });
    const put = fakeS3.commands.find(
      (command) => command.name === "PutObjectCommand",
    )!;
    expect(put.input).toMatchObject({
      IfNoneMatch: "*",
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: "fixture-kms-key",
      BucketKeyEnabled: true,
    });
    expect(put.input).not.toHaveProperty("ACL");
    expect(fakeS3.commands.map((command) => command.name)).toEqual(
      expect.arrayContaining([
        "GetPublicAccessBlockCommand",
        "GetBucketPolicyStatusCommand",
        "GetBucketVersioningCommand",
        "GetBucketEncryptionCommand",
      ]),
    );
  });
});
