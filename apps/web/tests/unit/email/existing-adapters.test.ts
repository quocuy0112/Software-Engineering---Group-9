import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CaptureEmailAdapter } from "@/server/email/capture-adapter";
import { ResendEmailAdapter } from "@/server/email/resend-adapter";

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
    const directory = resolve(process.cwd(), ".local", "mail");
    const before = new Set(await readdir(directory).catch(() => []));
    const result = await new CaptureEmailAdapter().send(message);
    expect(result.providerMessageId).toMatch(/^capture:/);
    const created = (await readdir(directory)).filter(
      (name) => !before.has(name),
    );
    const bodies = await Promise.all(
      created.map((name) => readFile(resolve(directory, name), "utf8")),
    );
    expect(
      bodies.filter((body) => body.includes(message.idempotencyKey)),
    ).toHaveLength(1);
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
