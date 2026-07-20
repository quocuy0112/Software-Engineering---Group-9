import { readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CaptureEmailAdapter } from "@/server/email/capture-adapter";
import { ResendEmailAdapter } from "@/server/email/resend-adapter";
const message = { kind: "VERIFY_EMAIL" as const, recipient: "user@example.test", subject: "Verify", html: "<p>Verify</p>", text: "Verify", idempotencyKey: "provider-regression" };
describe("email provider regressions", () => {
  it("keeps capture network-free", async () => {
    const directory = resolve(process.cwd(), ".local/mail"); const before = new Set(await readdir(directory).catch(() => []));
    await new CaptureEmailAdapter().send(message); const created = (await readdir(directory)).filter((name) => !before.has(name));
    const bodies = await Promise.all(created.map(async (name) => ({ name, body: await readFile(resolve(directory, name), "utf8") })));
    const own = bodies.filter(({ body }) => body.includes(message.idempotencyKey)); expect(own).toHaveLength(1);
    await Promise.all(own.map(({ name }) => rm(resolve(directory, name))));
  });
  it("keeps Resend behind EmailService with idempotency", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "resend-id" }, error: null });
    const adapter = new ResendEmailAdapter(() => ({ emails: { send } }) as never, { apiKey: "test-key", from: "sender@example.test" });
    await expect(adapter.send(message)).resolves.toEqual({ providerMessageId: "resend-id" });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ headers: { "Idempotency-Key": message.idempotencyKey } }));
  });
});
