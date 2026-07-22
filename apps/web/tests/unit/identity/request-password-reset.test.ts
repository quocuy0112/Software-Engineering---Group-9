import { describe, expect, it, vi } from "vitest";
import { RequestPasswordResetService } from "@/server/services/identity/request-password-reset";

describe("request password reset", () => {
  it("returns the same safe accepted contract for eligible and unknown accounts", async () => {
    const repository = { replaceForActiveUser: vi.fn().mockResolvedValue(null) };
    const limiter = { consume: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }) };
    const service = new RequestPasswordResetService(repository as never, limiter as never);
    const existing = await service.execute("active@example.test", "browser-a", new Date());
    const unknown = await service.execute("unknown@example.test", "browser-b", new Date());
    expect(existing).toMatchObject({ accepted: true, status: 202, message: expect.any(String) });
    expect(unknown).toMatchObject({ accepted: true, status: 202, message: existing.message });
    expect(repository.replaceForActiveUser).toHaveBeenCalledTimes(2);
    expect(existing).not.toHaveProperty("token");
    expect(existing).not.toHaveProperty("password");
  });

  it("returns generic throttling metadata without invoking persistence", async () => {
    const repository = { replaceForActiveUser: vi.fn() };
    const limiter = { consume: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 12 }) };
    const service = new RequestPasswordResetService(repository as never, limiter as never);
    await expect(service.execute("user@example.test", "browser", new Date())).resolves.toMatchObject({
      accepted: false,
      status: 429,
      retryAfterSeconds: 12,
    });
    expect(repository.replaceForActiveUser).not.toHaveBeenCalled();
  });
});
