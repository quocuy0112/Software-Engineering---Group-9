import "server-only";
import type { AccountPreferences as StoredAccountPreferences } from "@/backend/generated/prisma/client";
import { PrismaAccountPreferencesRepository } from "@/backend/repositories/account/prisma-account-preferences-repository";
import {
  ACCOUNT_PREFERENCES_DEFAULTS,
  accountPreferencesMutationSchema,
  accountPreferencesMutationOutcomeSchema,
  accountPreferencesSchema,
  type AccountPreferences,
  type AccountPreferencesMutation,
  type AccountPreferencesMutationOutcome,
} from "@/shared/contracts/account/preferences";

export class UnsupportedTimezoneError extends Error {
  constructor() {
    super("ACCOUNT_TIMEZONE_UNSUPPORTED");
  }
}

export class AccountPreferencesInvalidError extends Error {
  constructor() {
    super("ACCOUNT_PREFERENCES_INVALID");
  }
}

export function isSupportedTimeZone(timezone: string): boolean {
  const hasControlCharacter = Array.from(timezone).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
  if (
    !timezone ||
    timezone !== timezone.trim() ||
    timezone.length > 100 ||
    hasControlCharacter
  ) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(
      new Date(0),
    );
    return true;
  } catch {
    return false;
  }
}

type PreferencesPort = Pick<
  PrismaAccountPreferencesRepository,
  "find" | "replace"
>;

function project(row: StoredAccountPreferences): AccountPreferences {
  return accountPreferencesSchema.parse({
    language: row.language === "VI" ? "vi" : "en",
    timezone: row.timezone,
    timezoneSupported: isSupportedTimeZone(row.timezone),
    emailNotifications: {
      application_updates: row.applicationUpdatesEmail,
      job_recommendations: row.jobRecommendationsEmail,
      account_security: row.accountSecurityEmail,
    },
  });
}

export class AccountPreferencesService {
  constructor(
    private readonly repository: PreferencesPort = new PrismaAccountPreferencesRepository(),
  ) {}

  async get(userId: string): Promise<AccountPreferences> {
    const row = await this.repository.find(userId);
    if (!row) {
      return accountPreferencesSchema.parse({
        ...ACCOUNT_PREFERENCES_DEFAULTS,
        emailNotifications: {
          ...ACCOUNT_PREFERENCES_DEFAULTS.emailNotifications,
        },
        timezoneSupported: true,
      });
    }
    return project(row);
  }

  async update(
    userId: string,
    input: AccountPreferencesMutation,
  ): Promise<AccountPreferencesMutationOutcome> {
    const parsed = accountPreferencesMutationSchema.safeParse(input);
    if (!parsed.success) throw new AccountPreferencesInvalidError();
    const existing = await this.repository.find(userId);
    if (
      !isSupportedTimeZone(parsed.data.timezone) &&
      existing?.timezone !== parsed.data.timezone
    ) {
      throw new UnsupportedTimezoneError();
    }
    const saved = await this.repository.replace(userId, parsed.data);
    return accountPreferencesMutationOutcomeSchema.parse({
      preferences: project(saved),
      message: "Preferences saved.",
    });
  }
}
