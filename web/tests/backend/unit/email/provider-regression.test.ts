import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CaptureEmailAdapter } from "@/backend/email/capture-adapter";
import { ResendEmailAdapter } from "@/backend/email/resend-adapter";
const message = {
  kind: "VERIFY_EMAIL" as const,
  recipient: "user@example.test",
  subject: "Verify",
  html: "<p>Verify</p>",
  text: "Verify",
  idempotencyKey: "provider-regression",
};
describe("email provider regressions", () => {
  it("keeps capture network-free", async () => {
    const directory = await mkdtemp(join(tmpdir(), "smarthire-mail-"));
    try {
      await new CaptureEmailAdapter(directory).send(message);
      const bodies = await Promise.all(
        (await readdir(directory)).map(async (name) => ({
          name,
          body: await readFile(resolve(directory, name), "utf8"),
        })),
      );
      expect(
        bodies.filter(({ body }) => body.includes(message.idempotencyKey)),
      ).toHaveLength(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("keeps Resend behind EmailService with idempotency", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: { id: "resend-id" }, error: null });
    const adapter = new ResendEmailAdapter(
      () => ({ emails: { send } }) as never,
      { apiKey: "test-key", from: "sender@example.test" },
    );
    await expect(adapter.send(message)).resolves.toEqual({
      providerMessageId: "resend-id",
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { "Idempotency-Key": message.idempotencyKey },
      }),
    );
  });
  it.each([
    [422, "validation_error", false],
    [429, "rate_limit_exceeded", true],
    [503, "internal_server_error", true],
  ] as const)(
    "classifies Resend status %i without retaining provider details",
    async (statusCode, name, retryable) => {
      const send = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "provider detail", statusCode, name },
        headers: null,
      });
      const adapter = new ResendEmailAdapter(
        () => ({ emails: { send } }) as never,
        { apiKey: "test-key", from: "sender@example.test" },
      );
      await expect(adapter.send(message)).rejects.toMatchObject({
        message: "Email delivery failed",
        code: "EMAIL_PROVIDER_REJECTED",
        retryable,
      });
    },
  );
});
