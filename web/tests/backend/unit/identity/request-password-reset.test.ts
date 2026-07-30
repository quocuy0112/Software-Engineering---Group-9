import { describe, expect, it, vi } from "vitest";
import {
  PASSWORD_RECOVERY_ACCOUNT_NOT_FOUND_ERROR,
  PASSWORD_RECOVERY_SUCCESS_RESPONSE,
} from "@/shared/contracts/identity/password-recovery";
import { RequestPasswordResetService } from "@/backend/services/recovery/request-password-reset";

describe("request password reset", () => {
  it("returns success only for an eligible account and account-not-found otherwise", async () => {
    const repository = {
      replaceForActiveUser: vi
        .fn()
        .mockResolvedValueOnce({ userId: "user-id", tokenId: "token-id" })
        .mockResolvedValueOnce(null),
    };
    const limiter = { consume: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }) };
    const service = new RequestPasswordResetService(repository as never, limiter as never);
    const existing = await service.execute("active@example.test", "browser-a", new Date());
    const unknown = await service.execute("unknown@example.test", "browser-b", new Date());
    expect(existing).toMatchObject({
      accepted: true,
      status: 202,
      message: PASSWORD_RECOVERY_SUCCESS_RESPONSE,
    });
    expect(unknown).toMatchObject({
      accepted: false,
      status: 404,
      message: PASSWORD_RECOVERY_ACCOUNT_NOT_FOUND_ERROR,
    });
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
