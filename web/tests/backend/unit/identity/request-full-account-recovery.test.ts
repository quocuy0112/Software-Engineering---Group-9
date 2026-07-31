import { describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_RECOVERY_REQUEST_FAILED_ERROR,
  ACCOUNT_RECOVERY_SUCCESS_RESPONSE,
  PASSWORD_RECOVERY_ACCOUNT_NOT_FOUND_ERROR,
  PASSWORD_RECOVERY_SUCCESS_RESPONSE,
} from "@/shared/contracts/identity/password-recovery";
import { RequestFullAccountRecoveryService } from "@/backend/services/recovery/request-full-account-recovery";

const allowedLimiter = {
  consume: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
};
const protector = {
  digest: vi.fn().mockReturnValue("rate-subject"),
  generate: vi.fn().mockReturnValue("raw-proof"),
  seal: vi.fn().mockReturnValue("protected-proof"),
};

describe("request full account recovery", () => {
  it("uses full recovery for 2FA accounts and password reset for active accounts without 2FA", async () => {
    const repository = {
      replaceConfirmationForEligibleUser: vi
        .fn()
        .mockResolvedValueOnce({ userId: "user-id", tokenId: "token-id" })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
    };
    const passwordReset = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({
          accepted: true,
          status: 202,
          message: PASSWORD_RECOVERY_SUCCESS_RESPONSE,
        })
        .mockResolvedValueOnce({
          accepted: false,
          status: 404,
          message: PASSWORD_RECOVERY_ACCOUNT_NOT_FOUND_ERROR,
        }),
    };
    const service = new RequestFullAccountRecoveryService(
      repository as never,
      allowedLimiter as never,
      protector as never,
      passwordReset as never,
    );

    await expect(
      service.execute("eligible@example.test"),
    ).resolves.toMatchObject({
      accepted: true,
      status: 202,
      message: ACCOUNT_RECOVERY_SUCCESS_RESPONSE,
    });
    await expect(
      service.execute("active-without-2fa@example.test"),
    ).resolves.toMatchObject({
      accepted: true,
      status: 202,
      message: PASSWORD_RECOVERY_SUCCESS_RESPONSE,
    });
    await expect(
      service.execute("missing@example.test"),
    ).resolves.toMatchObject({
      accepted: false,
      status: 404,
      message: PASSWORD_RECOVERY_ACCOUNT_NOT_FOUND_ERROR,
    });
    expect(passwordReset.execute).toHaveBeenCalledTimes(2);
  });

  it("does not claim success when persistence fails", async () => {
    const repository = {
      replaceConfirmationForEligibleUser: vi
        .fn()
        .mockRejectedValue(new Error("database unavailable")),
    };
    const service = new RequestFullAccountRecoveryService(
      repository as never,
      allowedLimiter as never,
      protector as never,
      undefined,
    );
    await expect(
      service.execute("eligible@example.test"),
    ).resolves.toMatchObject({
      accepted: false,
      status: 503,
      message: ACCOUNT_RECOVERY_REQUEST_FAILED_ERROR,
    });
  });
});
