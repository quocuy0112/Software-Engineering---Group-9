import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { AccountPreferencesService } from "@/backend/services/account/account-preferences-service";
import {
  createProfileDatabaseAccount,
  deleteProfileDatabaseAccounts,
} from "../../../helpers/profile-database-fixture";

let owner: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;
let legacy: Awaited<ReturnType<typeof createProfileDatabaseAccount>>;

beforeAll(async () => {
  owner = await createProfileDatabaseAccount("preferences-owner");
  legacy = await createProfileDatabaseAccount("preferences-legacy");
});

afterAll(async () => {
  await deleteProfileDatabaseAccounts([owner.userId, legacy.userId]);
});

describe("account preferences persistence", () => {
  it("reads virtual defaults without inserting a row", async () => {
    await expect(
      new AccountPreferencesService().get(owner.userId),
    ).resolves.toMatchObject({
      language: "vi",
      timezone: "Asia/Ho_Chi_Minh",
      timezoneSupported: true,
      emailNotifications: {
        application_updates: true,
        job_recommendations: true,
        account_security: true,
      },
    });
    expect(
      await prisma.accountPreferences.count({
        where: { userId: owner.userId },
      }),
    ).toBe(0);
  });

  it("atomically replaces one owner-scoped set visible to every session", async () => {
    const service = new AccountPreferencesService();
    const result = await service.update(owner.userId, {
      language: "en",
      timezone: "Europe/Paris",
      emailNotifications: {
        application_updates: false,
        job_recommendations: true,
        account_security: true,
      },
    });
    expect(result).toMatchObject({
      preferences: {
        language: "en",
        timezone: "Europe/Paris",
        timezoneSupported: true,
      },
    });
    await expect(service.get(owner.userId)).resolves.toEqual(
      result.preferences,
    );
    await expect(service.get(legacy.userId)).resolves.toMatchObject({
      language: "vi",
      timezone: "Asia/Ho_Chi_Minh",
    });
    expect(
      await prisma.accountPreferences.count({
        where: { userId: owner.userId },
      }),
    ).toBe(1);
  });

  it("enforces mandatory account-security mail in service and PostgreSQL", async () => {
    const before = await prisma.accountPreferences.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    await expect(
      new AccountPreferencesService().update(owner.userId, {
        language: "vi",
        timezone: "UTC",
        emailNotifications: {
          application_updates: true,
          job_recommendations: true,
          account_security: false,
        },
      } as never),
    ).rejects.toThrow("ACCOUNT_PREFERENCES_INVALID");
    await expect(
      prisma.accountPreferences.update({
        where: { userId: owner.userId },
        data: { accountSecurityEmail: false },
      }),
    ).rejects.toThrow();
    expect(
      await prisma.accountPreferences.findUniqueOrThrow({
        where: { userId: owner.userId },
      }),
    ).toEqual(before);
  });

  it("projects an unsupported legacy timezone and preserves only that exact value", async () => {
    await prisma.accountPreferences.create({
      data: {
        userId: legacy.userId,
        language: "VI",
        timezone: "Legacy/Removed_Zone",
        applicationUpdatesEmail: true,
        jobRecommendationsEmail: true,
        accountSecurityEmail: true,
      },
    });
    const service = new AccountPreferencesService();
    await expect(service.get(legacy.userId)).resolves.toMatchObject({
      timezone: "Legacy/Removed_Zone",
      timezoneSupported: false,
    });
    await expect(
      service.update(legacy.userId, {
        language: "en",
        timezone: "Legacy/Removed_Zone",
        emailNotifications: {
          application_updates: false,
          job_recommendations: false,
          account_security: true,
        },
      }),
    ).resolves.toMatchObject({
      preferences: {
        timezone: "Legacy/Removed_Zone",
        timezoneSupported: false,
      },
    });
    await expect(
      service.update(legacy.userId, {
        language: "en",
        timezone: "Legacy/Different_Zone",
        emailNotifications: {
          application_updates: false,
          job_recommendations: false,
          account_security: true,
        },
      }),
    ).rejects.toThrow("ACCOUNT_TIMEZONE_UNSUPPORTED");
    expect(
      (
        await prisma.accountPreferences.findUniqueOrThrow({
          where: { userId: legacy.userId },
        })
      ).timezone,
    ).toBe("Legacy/Removed_Zone");
  });
});
