"use client";

import { useMemo, useState } from "react";
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

function timezoneSearchText(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function TimezonePicker({
  value,
  options,
  describedBy,
  onChange,
}: {
  value: string;
  options: TimezoneOption[];
  describedBy: string;
  onChange: (timezone: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const matches = useMemo(() => {
    const search = timezoneSearchText(query.trim());
    return options.filter((option) =>
      timezoneSearchText(`${option.label} ${option.value}`).includes(search),
    );
  }, [options, query]);
  const visibleOptions = matches.slice(0, 8);

  function choose(timezone: string) {
    onChange(timezone);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="account-timezone-picker">
      <input
        id="preference-timezone"
        type="search"
        role="combobox"
        autoComplete="off"
        value={open ? query : (selected?.label ?? value)}
        placeholder="GMT+07:00 · Asia/Ho_Chi_Minh"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-controls="preference-timezone-options"
        aria-expanded={open}
        aria-describedby={describedBy}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          setOpen(true);
          setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
          if (event.key === "Enter" && visibleOptions[0]) {
            event.preventDefault();
            choose(visibleOptions[0].value);
          }
        }}
      />
      <button
        className="account-timezone-toggle"
        type="button"
        aria-label="Toggle timezone list"
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="account-timezone-results" id="preference-timezone-options">
          <ul role="listbox" aria-label="Timezone options">
            {visibleOptions.map((option) => (
              <li key={option.value} role="option" aria-selected={option.value === value}>
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option.value)}>
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
          {matches.length > visibleOptions.length ? (
            <p>Keep typing to narrow {matches.length} timezones.</p>
          ) : null}
          {!visibleOptions.length ? <p>No matching timezone.</p> : null}
        </div>
      ) : null}
    </div>
  );
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
  const [timezoneOptions] = useState<TimezoneOption[]>(() =>
    getTimezoneOptions([preferences.timezone]),
  );
  const locale = useWorkspaceLocale();

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
          className="account-preferences-select"
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
        <TimezonePicker
          value={preferences.timezone}
          options={timezoneOptions}
          describedBy={
            preferences.timezoneSupported
              ? "timezone-guidance timezone-list-guidance"
              : "timezone-unsupported-guidance timezone-list-guidance"
          }
          onChange={(timezone) =>
            onChange({
              ...preferences,
              timezone,
              timezoneSupported: supportsTimezone(timezone),
            })
          }
        />
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
