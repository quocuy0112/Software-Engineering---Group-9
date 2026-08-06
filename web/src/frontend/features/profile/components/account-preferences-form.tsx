"use client";

import { useEffect, useRef, useState } from "react";
import type { AccountPreferences } from "@/shared/contracts/account/preferences";
import {
  getTimezoneOptions,
  type TimezoneOption,
} from "../client/timezone-options";
import { NotificationPreferences } from "./notification-preferences";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

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
  const locale = useWorkspaceLocale();

  useEffect(() => {
    setTimezoneOptions(getTimezoneOptions([initialTimezone.current]));
  }, []);

  const copy =
    locale === "vi"
      ? {
          language: "Ngôn ngữ giao diện",
          languageHint: "Chọn ngôn ngữ hiển thị cho không gian làm việc.",
          timezone: "Múi giờ",
          timezoneHint: "Sử dụng mã múi giờ IANA được hỗ trợ.",
          timezoneWarning:
            "Múi giờ đã lưu không còn được hỗ trợ. Hãy giữ nguyên hoặc chọn múi giờ khác.",
          saving: "Đang lưu tùy chọn…",
          save: "Lưu tùy chọn",
          timezoneListHint: `Tìm theo độ lệch GMT, khu vực hoặc thành phố. Thiết bị hỗ trợ ${timezoneOptions.length || "các"} múi giờ IANA; GMT phản ánh thời gian hiện tại và tự điều chỉnh theo giờ mùa hè.`,
        }
      : {
          language: "Interface language",
          languageHint: "Choose the display language for your workspace.",
          timezone: "Timezone",
          timezoneHint: "Use a supported IANA timezone identifier.",
          timezoneWarning:
            "This stored timezone is no longer supported. Keep it unchanged or choose a supported replacement.",
          saving: "Saving preferences…",
          save: "Save preferences",
          timezoneListHint: `Search by GMT offset, region, or city. The list includes ${timezoneOptions.length || "the"} IANA timezones supported by this device; GMT reflects the current time and adjusts for DST.`,
        };
  const timezoneListHint = copy.timezoneListHint;
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
          aria-describedby="interface-language-guidance"
          onChange={(event) =>
            onChange({
              ...preferences,
              language: event.target.value as AccountPreferences["language"],
            })
          }
        >
          <option value="en">English</option>
          <option value="vi">Tiếng Việt</option>
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
