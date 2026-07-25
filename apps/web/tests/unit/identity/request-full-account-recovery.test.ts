import { describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_RECOVERY_NOT_ELIGIBLE_ERROR,
  ACCOUNT_RECOVERY_REQUEST_FAILED_ERROR,
  ACCOUNT_RECOVERY_SUCCESS_RESPONSE,
} from "@/features/identity/schemas/password-recovery";
import { RequestFullAccountRecoveryService } from "@/server/services/identity/request-full-account-recovery";

const allowedLimiter = {
  consume: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
};
const protector = {
  digest: vi.fn().mockReturnValue("rate-subject"),
  generate: vi.fn().mockReturnValue("raw-proof"),
  seal: vi.fn().mockReturnValue("protected-proof"),
};

describe("request full account recovery", () => {
  it("returns success only after an eligible recovery request is created", async () => {
    const repository = {
      replaceConfirmationForEligibleUser: vi
        .fn()
        .mockResolvedValueOnce({ userId: "user-id", tokenId: "token-id" })
        .mockResolvedValueOnce(null),
    };
    const service = new RequestFullAccountRecoveryService(
      repository as never,
      allowedLimiter as never,
      protector as never,
    );

    await expect(
      service.execute("eligible@example.test"),
    ).resolves.toMatchObject({
      accepted: true,
      status: 202,
      message: ACCOUNT_RECOVERY_SUCCESS_RESPONSE,
    });
    await expect(
      service.execute("missing@example.test"),
    ).resolves.toMatchObject({
      accepted: false,
      status: 404,
      message: ACCOUNT_RECOVERY_NOT_ELIGIBLE_ERROR,
    });
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
