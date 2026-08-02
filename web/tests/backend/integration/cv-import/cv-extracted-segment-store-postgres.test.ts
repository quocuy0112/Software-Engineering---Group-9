import { createHash } from "node:crypto";
import { Pool } from "pg";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { ExtractedSegmentStore } from "@/backend/cv/extraction/extracted-segment-store";
import type { PrivateCvStorage } from "@/backend/cv/storage/private-cv-storage";
import {
  cleanupCvRecoveryAccounts,
  seedCvRecoveryImport,
} from "../../../helpers/cv-failure-retry-fixture";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const accounts: string[] = [];
const now = new Date("2026-08-01T05:00:00.000Z");

afterEach(async () => {
  const client = await pool.connect();
  try {
    await cleanupCvRecoveryAccounts(client, accounts.splice(0));
  } finally {
    client.release();
  }
});

afterAll(async () => pool.end());

describe.sequential("PostgreSQL extracted-segment authorization", () => {
  it("reads bytea envelope fields through encoded projections and verifies the owned parse input", async () => {
    const client = await pool.connect();
    const seeded = await seedCvRecoveryImport(client, "segment-postgres", {
      stage: "PARSE",
      mode: "PROCESSING",
      now,
    });
    accounts.push(seeded.accountId);
    const serialized = Buffer.from(
      `${JSON.stringify({
        id: "segment-1",
        kind: "paragraph",
        text: "Synthetic CV",
      })}\n`,
      "utf8",
    );
    const ciphertext = Buffer.alloc(serialized.byteLength, 7);
    await client.query(
      `UPDATE "CvStoredArtifact"
          SET "plaintextBytes" = $2, "ciphertextBytes" = $3,
              "plaintextSha256" = decode($4, 'hex'),
              "encryptionIv" = decode(repeat('61', 12), 'hex'),
              "authenticationTag" = decode(repeat('62', 16), 'hex')
        WHERE "id" = $1`,
      [
        seeded.outputId,
        serialized.byteLength,
        ciphertext.byteLength,
        createHash("sha256").update(serialized).digest("hex"),
      ],
    );
    client.release();

    const storage: PrivateCvStorage = {
      assertReady: vi.fn(async () => undefined),
      open: vi.fn(() =>
        (async function* () {
          yield ciphertext;
        })(),
      ),
      put: vi.fn(),
      delete: vi.fn(),
      inventory: vi.fn(),
    };
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

    await expect(
      store.openAuthorized({
        accountId: seeded.accountId,
        uploadId: seeded.uploadId,
        artifactId: seeded.outputId!,
        parseJobId: seeded.parseId!,
      }),
    ).resolves.toEqual([
      { id: "segment-1", kind: "paragraph", text: "Synthetic CV" },
    ]);
    expect(storage.assertReady).toHaveBeenCalledOnce();
    expect(storage.open).toHaveBeenCalledOnce();
  });
});
