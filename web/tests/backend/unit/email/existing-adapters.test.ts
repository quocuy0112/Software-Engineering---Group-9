import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CaptureEmailAdapter } from "@/backend/email/capture-adapter";
import { ResendEmailAdapter } from "@/backend/email/resend-adapter";

const message = {
  kind: "VERIFY_EMAIL" as const,
  recipient: "existing-adapter@example.test",
  subject: "Verify",
  html: "<p>Verify</p>",
  text: "Verify",
  idempotencyKey: "verification:existing-adapter",
};

describe("existing email adapters", () => {
  it("keeps local capture functional", async () => {
    const directory = await mkdtemp(join(tmpdir(), "smarthire-mail-"));
    try {
      const result = await new CaptureEmailAdapter(directory).send(message);
      expect(result.providerMessageId).toMatch(/^capture:/);
      const bodies = await Promise.all(
        (await readdir(directory)).map((name) =>
          readFile(resolve(directory, name), "utf8"),
        ),
      );
      expect(
        bodies.filter((body) => body.includes(message.idempotencyKey)),
      ).toHaveLength(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("keeps Resend delivery functional through its provider boundary", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: { id: "resend-message-id" }, error: null });
    const adapter = new ResendEmailAdapter(
      () => ({ emails: { send } }) as never,
      { apiKey: "re_test", from: "SmartHire <sender@example.test>" },
    );
    await expect(adapter.send(message)).resolves.toEqual({
      providerMessageId: "resend-message-id",
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: message.recipient,
        headers: { "Idempotency-Key": message.idempotencyKey },
      }),
    );
  });
});
