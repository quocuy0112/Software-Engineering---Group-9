import { describe, expect, it, vi } from "vitest";
import { ResetPasswordService } from "@/server/services/identity/reset-password";

describe("reset password service policy", () => {
  it.each(["invalid", "used", "expired"])("maps %s token state generically", async (status) => {
    const repository = { consume: vi.fn().mockResolvedValue({ status }) };
    const service = new ResetPasswordService(repository as never, {} as never, {} as never, { evaluate: vi.fn().mockResolvedValue({ accepted: true }) } as never);
    await expect(service.execute("opaque", "correct horse 2026")).resolves.toMatchObject({ ok: false, message: expect.stringContaining("invalid") });
  });

  it("rejects a compromised password before consuming the reset token", async () => {
    const repository = { consume: vi.fn() };
    const service = new ResetPasswordService(repository as never, {} as never, {} as never);
    await expect(service.execute("opaque", "qwerty123456")).resolves.toMatchObject({ ok: false });
    expect(repository.consume).not.toHaveBeenCalled();
  });
});
