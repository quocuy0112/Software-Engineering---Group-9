import { describe, expect, it } from "vitest";
import {
  PASSWORD_CHANGE_LOCK_MS,
  PASSWORD_CHANGE_MAX_FAILURES,
  PASSWORD_CHANGE_WINDOW_MS,
  appendWrongCurrentFailure,
  passwordChangeRetryAfterSeconds,
  prunePasswordChangeFailures,
  shouldCountPasswordChangeFailure,
} from "@/backend/repositories/account/prisma-password-change-attempt-repository";

const now = new Date("2026-07-31T04:00:00.000Z");

describe("password-change attempt policy", () => {
  it("prunes failures outside the rolling prior 15 minutes", () => {
    expect(
      prunePasswordChangeFailures(
        [
          new Date(now.getTime() - PASSWORD_CHANGE_WINDOW_MS - 1),
          new Date(now.getTime() - PASSWORD_CHANGE_WINDOW_MS),
          new Date(now.getTime() - 1),
        ],
        now,
      ),
    ).toEqual([
      new Date(now.getTime() - PASSWORD_CHANGE_WINDOW_MS),
      new Date(now.getTime() - 1),
    ]);
  });

  it("counts only an authoritative wrong-current classification", () => {
    expect(shouldCountPasswordChangeFailure("CURRENT_PASSWORD_INVALID")).toBe(
      true,
    );
    for (const code of [
      "PASSWORD_POLICY",
      "PASSWORD_COMPROMISED",
      "PASSWORD_CONFIRMATION_MISMATCH",
      "PASSWORD_REUSE",
    ] as const) {
      expect(shouldCountPasswordChangeFailure(code)).toBe(false);
    }
  });

  it("locks exactly on the fifth serialized failure for 15 minutes", () => {
    let state = {
      failureTimestamps: [] as Date[],
      lockedUntil: null as Date | null,
    };
    for (let index = 0; index < PASSWORD_CHANGE_MAX_FAILURES; index += 1) {
      state = appendWrongCurrentFailure(
        state.failureTimestamps,
        new Date(now.getTime() + index),
      );
    }
    expect(state.failureTimestamps).toHaveLength(5);
    expect(state.lockedUntil).toEqual(
      new Date(now.getTime() + 4 + PASSWORD_CHANGE_LOCK_MS),
    );
  });

  it("returns bounded ceiling retry seconds and permits work at expiry", () => {
    const lockedUntil = new Date(now.getTime() + 1_001);
    expect(passwordChangeRetryAfterSeconds(lockedUntil, now)).toBe(2);
    expect(passwordChangeRetryAfterSeconds(now, now)).toBeNull();
    expect(
      passwordChangeRetryAfterSeconds(
        new Date(now.getTime() + PASSWORD_CHANGE_LOCK_MS),
        now,
      ),
    ).toBe(900);
  });
});
