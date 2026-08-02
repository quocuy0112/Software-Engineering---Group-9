import { describe, expect, it, vi } from "vitest";
import {
  AccountPreferencesService,
  UnsupportedTimezoneError,
  isSupportedTimeZone,
} from "@/backend/services/account/account-preferences-service";

const stored = {
  userId: "preferences-user",
  language: "VI" as const,
  timezone: "Legacy/Removed_Zone",
  applicationUpdatesEmail: true,
  jobRecommendationsEmail: false,
  accountSecurityEmail: true,
  createdAt: new Date("2026-07-31T00:00:00.000Z"),
  updatedAt: new Date("2026-07-31T00:00:00.000Z"),
};

describe("account-preferences validation", () => {
  it("accepts vi/en through the contract and validates current IANA zones", () => {
    expect(isSupportedTimeZone("Asia/Ho_Chi_Minh")).toBe(true);
    expect(isSupportedTimeZone("UTC")).toBe(true);
    expect(isSupportedTimeZone("Europe/Paris")).toBe(true);
    expect(isSupportedTimeZone("Mars/Olympus")).toBe(false);
    expect(isSupportedTimeZone("")).toBe(false);
  });

  it("returns exact defaults without writing when no row exists", async () => {
    const repository = {
      find: vi.fn().mockResolvedValue(null),
      replace: vi.fn(),
    };
    await expect(
      new AccountPreferencesService(repository).get("preferences-user"),
    ).resolves.toEqual({
      language: "en",
      timezone: "Asia/Ho_Chi_Minh",
      timezoneSupported: true,
      emailNotifications: {
        application_updates: true,
        job_recommendations: true,
        account_security: true,
      },
    });
    expect(repository.replace).not.toHaveBeenCalled();
  });

  it("preserves an unchanged unsupported stored zone but rejects a newly selected one", async () => {
    const repository = {
      find: vi.fn().mockResolvedValue(stored),
      replace: vi.fn().mockResolvedValue({
        ...stored,
        language: "EN",
      }),
    };
    const service = new AccountPreferencesService(repository);
    await expect(service.get(stored.userId)).resolves.toMatchObject({
      timezone: stored.timezone,
      timezoneSupported: false,
    });
    await expect(
      service.update(stored.userId, {
        language: "en",
        timezone: stored.timezone,
        emailNotifications: {
          application_updates: false,
          job_recommendations: false,
          account_security: true,
        },
      }),
    ).resolves.toMatchObject({
      preferences: {
        language: "en",
        timezone: stored.timezone,
        timezoneSupported: false,
      },
    });
    await expect(
      service.update(stored.userId, {
        language: "en",
        timezone: "Legacy/New_Invalid_Zone",
        emailNotifications: {
          application_updates: false,
          job_recommendations: false,
          account_security: true,
        },
      }),
    ).rejects.toBeInstanceOf(UnsupportedTimezoneError);
    expect(repository.replace).toHaveBeenCalledTimes(1);
  });

  it("rejects mandatory-security and incomplete values at the service boundary", async () => {
    const repository = {
      find: vi.fn().mockResolvedValue(null),
      replace: vi.fn(),
    };
    const service = new AccountPreferencesService(repository);
    await expect(
      service.update("preferences-user", {
        language: "vi",
        timezone: "UTC",
        emailNotifications: {
          application_updates: true,
          job_recommendations: true,
          account_security: false,
        },
      } as never),
    ).rejects.toThrow("ACCOUNT_PREFERENCES_INVALID");
    expect(repository.replace).not.toHaveBeenCalled();
  });
});
