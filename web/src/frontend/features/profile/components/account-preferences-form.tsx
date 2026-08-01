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
  const copy =
    preferences.language === "vi"
      ? {
          language: "Ngôn ngữ giao diện",
          timezone: "Múi giờ",
          timezoneHint: "Sử dụng mã múi giờ IANA được hỗ trợ.",
          timezoneWarning:
            "Múi giờ đã lưu không còn được hỗ trợ. Hãy giữ nguyên hoặc chọn múi giờ khác.",
          saving: "Đang lưu tùy chọn…",
          save: "Lưu tùy chọn",
        }
      : {
          language: "Interface language",
          timezone: "Timezone",
          timezoneHint: "Use a supported IANA timezone identifier.",
          timezoneWarning:
            "This stored timezone is no longer supported. Keep it unchanged or choose a supported replacement.",
          saving: "Saving preferences…",
          save: "Save preferences",
        };
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

        <label htmlFor="preference-timezone">{copy.timezone}</label>
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
        locale={preferences.language}
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
