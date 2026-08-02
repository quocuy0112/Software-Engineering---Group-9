import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/backend/database/prisma", () => ({
  prisma: {
    $queryRaw: database.queryRaw,
    cvStoredArtifact: {
      updateMany: database.updateMany,
    },
  },
}));

import { ExtractedSegmentStore } from "@/backend/cv/extraction/extracted-segment-store";
import type { PrivateCvStorage } from "@/backend/cv/storage/private-cv-storage";

describe("encrypted extracted-segment storage", () => {
  it("establishes private-storage readiness before reading an authorized artifact", async () => {
    const serialized = Buffer.from(
      `${JSON.stringify({
        id: "segment-1",
        kind: "paragraph",
        text: "Synthetic CV",
      })}\n`,
      "utf8",
    );
    const ciphertext = Buffer.alloc(serialized.byteLength, 7);
    const assertReady = vi.fn(async () => undefined);
    const open = vi.fn(() =>
      (async function* () {
        yield ciphertext;
      })(),
    );
    const storage: PrivateCvStorage = {
      assertReady,
      open,
      put: vi.fn(),
      delete: vi.fn(),
      inventory: vi.fn(),
    };
    database.queryRaw.mockResolvedValueOnce([
      {
        id: "artifact_fixture",
        storageLocator: "fixture-locator",
        ciphertextBytes: ciphertext.byteLength,
        plaintextBytes: serialized.byteLength,
        plaintextSha256Hex: createHash("sha256")
          .update(serialized)
          .digest("hex"),
        encryptionKeyVersion: 1,
        encryptionIvHex: Buffer.alloc(12, 1).toString("hex"),
        authenticationTagHex: Buffer.alloc(16, 2).toString("hex"),
      },
    ]);
    const cryptor = {
      decrypt: vi.fn(async ({ plaintext }) => {
        await new Promise<void>((resolve, reject) => {
          plaintext.write(serialized, (error: Error | null | undefined) =>
            error ? reject(error) : resolve(),
          );
        });
        return {
          ciphertextBytes: ciphertext.byteLength,
          plaintextBytes: serialized.byteLength,
        };
      }),
    };
    const store = new ExtractedSegmentStore({
      storage,
      cryptor: cryptor as never,
      quota: {} as never,
    });

    const segments = await store.openAuthorized({
      accountId: "account_fixture",
      uploadId: "upload_fixture",
      artifactId: "artifact_fixture",
      parseJobId: "parse_fixture",
    });

    expect(assertReady).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
    expect(assertReady.mock.invocationCallOrder[0]).toBeLessThan(
      open.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(segments).toEqual([
      { id: "segment-1", kind: "paragraph", text: "Synthetic CV" },
    ]);
    expect(database.updateMany).not.toHaveBeenCalled();
  });
});
