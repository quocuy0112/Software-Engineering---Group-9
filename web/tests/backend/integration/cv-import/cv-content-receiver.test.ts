import { Readable, Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { createArtifactCryptor } from "@/backend/cv/encryption/artifact-cryptor";
import { ReceiveCvContentService } from "@/backend/services/cv-import/receive-cv-content";

function harness() {
  const stored: Buffer[] = [];
  const finalized = vi.fn(async () => true);
  const scheduledForDeletion = vi.fn(async () => undefined);
  const cryptor = createArtifactCryptor({
    activeKeyVersion: 1,
    keys: { 1: Buffer.alloc(32, 9) },
  });
  const service = new ReceiveCvContentService({
    findReservation: async () => ({
      uploadId: "upload_fixture",
      accountId: "account_fixture",
      artifactId: "artifact_fixture",
      documentKind: "PDF" as const,
      declaredMediaType: "application/pdf",
      declaredBytes: 16,
      status: "AWAITING_CONTENT" as const,
    }),
    cryptor,
    createCiphertextSink: async () =>
      new Writable({
        write(chunk, _encoding, done) {
          stored.push(Buffer.from(chunk));
          done();
        },
      }),
    finalize: finalized,
    scheduleForDeletion: scheduledForDeletion,
  });
  return { service, stored, finalized, scheduledForDeletion };
}

describe("bounded CV content receiver", () => {
  it("streams exact content through encryption, computes SHA-256, and queues validation", async () => {
    const { service, stored, finalized } = harness();
    const plaintext = Buffer.from("%PDF-synthetic!!");
    const outcome = await service.execute({
      accountId: "account_fixture",
      uploadId: "upload_fixture",
      contentType: "application/pdf",
      contentLength: plaintext.byteLength,
      body: Readable.from([plaintext.subarray(0, 5), plaintext.subarray(5)]),
      idempotencyKey: "fixture-key_1234567890",
    });
    expect(outcome.status).toBe("VALIDATION_QUEUED");
    expect(outcome.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(Buffer.concat(stored)).not.toEqual(plaintext);
    expect(finalized).toHaveBeenCalledOnce();
  });

  it.each([
    ["short stream", 16, Buffer.from("short")],
    ["extra stream", 16, Buffer.alloc(17)],
    ["over global cap", 5_000_001, Buffer.alloc(1)],
  ])(
    "rejects %s and schedules disposable ciphertext cleanup",
    async (_label, length, body) => {
      const { service, scheduledForDeletion } = harness();
      await expect(
        service.execute({
          accountId: "account_fixture",
          uploadId: "upload_fixture",
          contentType: "application/pdf",
          contentLength: length,
          body: Readable.from([body]),
          idempotencyKey: "fixture-key_1234567890",
        }),
      ).rejects.toBeInstanceOf(Error);
      expect(scheduledForDeletion).toHaveBeenCalled();
    },
  );

  it("rejects MIME mismatch and cleans up after database finalization failure", async () => {
    const first = harness();
    await expect(
      first.service.execute({
        accountId: "account_fixture",
        uploadId: "upload_fixture",
        contentType: "application/zip",
        contentLength: 16,
        body: Readable.from([Buffer.alloc(16)]),
        idempotencyKey: "fixture-key_1234567890",
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });

    const second = harness();
    second.finalized.mockResolvedValueOnce(false);
    await expect(
      second.service.execute({
        accountId: "account_fixture",
        uploadId: "upload_fixture",
        contentType: "application/pdf",
        contentLength: 16,
        body: Readable.from([Buffer.alloc(16)]),
        idempotencyKey: "fixture-key_1234567890",
      }),
    ).rejects.toMatchObject({ code: "IMPORT_STATE_CONFLICT" });
    expect(second.scheduledForDeletion).toHaveBeenCalled();
  });
});
