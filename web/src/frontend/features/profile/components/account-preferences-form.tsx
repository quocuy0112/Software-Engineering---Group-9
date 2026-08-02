"use client";

import { useEffect, useRef, useState } from "react";
import type { AccountPreferences } from "@/shared/contracts/account/preferences";
import {
  getTimezoneOptions,
  type TimezoneOption,
} from "../client/timezone-options";
import { NotificationPreferences } from "./notification-preferences";

function supportsTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(
      new Date(0),
    );
    return true;
  } catch {
    return false;
  }
}

export function AccountPreferencesForm({
  preferences,
  saving,
  onChange,
  onSave,
}: {
  preferences: AccountPreferences;
  saving: boolean;
  onChange: (preferences: AccountPreferences) => void;
  onSave: () => Promise<boolean>;
}) {
  const [timezoneOptions, setTimezoneOptions] = useState<TimezoneOption[]>([]);
  const initialTimezone = useRef(preferences.timezone);

  useEffect(() => {
    setTimezoneOptions(getTimezoneOptions([initialTimezone.current]));
  }, []);

  const copy = {
    language: "Interface language",
    languageHint: "English is the system interface language.",
    timezone: "Timezone",
    timezoneHint: "Use a supported IANA timezone identifier.",
    timezoneWarning:
      "This stored timezone is no longer supported. Keep it unchanged or choose a supported replacement.",
    saving: "Saving preferences…",
    save: "Save preferences",
  };
  const timezoneListHint = `Search by GMT offset, region, or city. The list includes ${timezoneOptions.length || "the"} IANA timezones supported by this device; GMT reflects the current time and adjusts for DST.`;
  return (
    <form
      className="account-preferences-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave();
      }}
    >
      <div className="account-preferences-fields">
        <label htmlFor="preference-language">{copy.language}</label>
        <select
          id="preference-language"
          value="en"
          aria-describedby="interface-language-guidance"
          disabled
        >
          <option value="en">English</option>
        </select>
        <p id="interface-language-guidance" className="preference-guidance">
          {copy.languageHint}
        </p>

        <label htmlFor="preference-timezone">{copy.timezone}</label>
        <input
          id="preference-timezone"
          list="preference-timezones"
          maxLength={100}
          value={preferences.timezone}
          placeholder="GMT+07:00 · Asia/Ho_Chi_Minh"
          aria-describedby={
            preferences.timezoneSupported
              ? "timezone-guidance timezone-list-guidance"
              : "timezone-unsupported-guidance timezone-list-guidance"
          }
          onChange={(event) =>
            onChange({
              ...preferences,
              timezone: event.target.value,
              timezoneSupported: supportsTimezone(event.target.value),
            })
          }
        />
        <datalist id="preference-timezones">
          {timezoneOptions.map((timezone) => (
            <option
              value={timezone.value}
              label={timezone.label}
              key={timezone.value}
            >
              {timezone.label}
            </option>
          ))}
        </datalist>
        <p id="timezone-list-guidance" className="preference-guidance">
          {timezoneListHint}
        </p>
        {preferences.timezoneSupported ? (
          <p id="timezone-guidance" className="preference-guidance">
            {copy.timezoneHint}
          </p>
        ) : (
          <p
            id="timezone-unsupported-guidance"
            className="preference-guidance preference-guidance--warning"
          >
            {copy.timezoneWarning}
          </p>
        )}
      </div>
      <NotificationPreferences
        value={preferences.emailNotifications}
        onChange={(emailNotifications) =>
          onChange({ ...preferences, emailNotifications })
        }
      />
      <button type="submit" disabled={saving}>
        {saving ? copy.saving : copy.save}
      </button>
    </form>
  );
}
