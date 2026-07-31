"use client";

import type { AccountPreferences } from "@/shared/contracts/account/preferences";
import { NotificationPreferences } from "./notification-preferences";

const commonTimezones = [
  "Asia/Ho_Chi_Minh",
  "UTC",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Europe/Paris",
  "America/New_York",
];

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
  return (
    <form
      className="account-preferences-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave();
      }}
    >
      <div className="account-preferences-fields">
        <label htmlFor="preference-language">Language</label>
        <select
          id="preference-language"
          value={preferences.language}
          onChange={(event) =>
            onChange({
              ...preferences,
              language: event.target.value as "vi" | "en",
            })
          }
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>

        <label htmlFor="preference-timezone">Timezone</label>
        <input
          id="preference-timezone"
          list="preference-timezones"
          maxLength={100}
          value={preferences.timezone}
          aria-describedby={
            preferences.timezoneSupported
              ? "timezone-guidance"
              : "timezone-unsupported-guidance"
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
          {commonTimezones.map((timezone) => (
            <option value={timezone} key={timezone} />
          ))}
        </datalist>
        {preferences.timezoneSupported ? (
          <p id="timezone-guidance" className="preference-guidance">
            Use a supported IANA timezone identifier.
          </p>
        ) : (
          <p
            id="timezone-unsupported-guidance"
            className="preference-guidance preference-guidance--warning"
          >
            This stored timezone is no longer supported. You may keep it
            unchanged or choose a supported replacement.
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
        {saving ? "Saving preferences..." : "Save preferences"}
      </button>
    </form>
  );
}
