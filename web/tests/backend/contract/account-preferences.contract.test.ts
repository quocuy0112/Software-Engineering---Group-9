import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_PREFERENCES_DEFAULTS,
  accountPreferencesMutationOutcomeSchema,
  accountPreferencesMutationSchema,
  accountPreferencesSchema,
} from "@/shared/contracts/account/preferences";

const valid = {
  language: "en",
  timezone: "Asia/Ho_Chi_Minh",
  emailNotifications: {
    application_updates: true,
    job_recommendations: true,
    account_security: true,
  },
};

describe("account preferences contract", () => {
  it("publishes the exact virtual defaults and timezone support metadata", () => {
    expect(ACCOUNT_PREFERENCES_DEFAULTS).toEqual(valid);
    expect(
      accountPreferencesSchema.parse({
        ...valid,
        timezoneSupported: true,
      }),
    ).toEqual({ ...valid, timezoneSupported: true });
  });

  it("requires one complete strict replacement set", () => {
    expect(accountPreferencesMutationSchema.safeParse(valid).success).toBe(
      true,
    );
    for (const invalid of [
      { ...valid, language: "fr" },
      { ...valid, timezone: "" },
      {
        ...valid,
        emailNotifications: {
          ...valid.emailNotifications,
          account_security: false,
        },
      },
      {
        ...valid,
        emailNotifications: {
          application_updates: true,
          account_security: true,
        },
      },
      {
        ...valid,
        emailNotifications: {
          ...valid.emailNotifications,
          marketing: true,
        },
      },
      { ...valid, extra: true },
    ]) {
      expect(accountPreferencesMutationSchema.safeParse(invalid).success).toBe(
        false,
      );
    }
  });

  it("returns only the authoritative preference projection and message", () => {
    const outcome = accountPreferencesMutationOutcomeSchema.parse({
      preferences: { ...valid, timezoneSupported: true },
      message: "Preferences saved.",
    });
    expect(Object.keys(outcome).sort()).toEqual(["message", "preferences"]);
    expect(JSON.stringify(outcome)).not.toMatch(/userId|accountId|session/i);
  });

  it("matches GET/PUT, defaults, strict schemas, and no-store OpenAPI", () => {
    const openapi = readFileSync(
      resolve(
        process.cwd(),
        "../spec-kit/specs/002-candidate-profile-account-management/contracts/openapi.yaml",
      ),
      "utf8",
    );
    expect(openapi).toContain("/api/account/preferences:");
    expect(openapi).toContain("operationId: getOwnAccountPreferences");
    expect(openapi).toContain("operationId: replaceOwnAccountPreferences");
    expect(openapi).toContain("AccountPreferencesMutation:");
    expect(openapi).toContain("account_security:");
    expect(openapi).toContain("const: true");
    expect(openapi).toContain("timezoneSupported:");
    expect(openapi.match(/NoStoreHeader/g)?.length).toBeGreaterThanOrEqual(9);
  });
});
