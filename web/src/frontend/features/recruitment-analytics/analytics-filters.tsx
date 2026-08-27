"use client";

import { useState } from "react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import {
  addCalendarDays,
  createAnalyticsDateRange,
  formatAnalyticsRange,
  isValidAnalyticsDateRange,
  type AnalyticsDateRange,
} from "./analytics-date-range";
import { recruitmentAnalyticsCopy } from "./recruitment-analytics-copy";

export function AnalyticsDateRangeControls({
  range,
  onApply,
  grouping,
  onGroupingChange,
  busy = false,
  label,
}: {
  range: AnalyticsDateRange;
  onApply: (next: AnalyticsDateRange) => void;
  grouping?: "DAY" | "WEEK" | "MONTH";
  onGroupingChange?: (next: "DAY" | "WEEK" | "MONTH") => void;
  busy?: boolean;
  label?: string;
}) {
  const locale = useWorkspaceLocale();
  const copy = recruitmentAnalyticsCopy(locale).filters;
  const effectiveLabel = label ?? copy.reportingWindow;
  const [fromDate, setFromDate] = useState(range.fromDate);
  const [toDate, setToDate] = useState(range.toDate);
  const [error, setError] = useState("");

  function apply(nextFrom = fromDate, nextTo = toDate) {
    if (!isValidAnalyticsDateRange(nextFrom, nextTo)) {
      setError(copy.invalidRange);
      return;
    }
    setError("");
    onApply(createAnalyticsDateRange(nextFrom, nextTo));
  }

  function applyPreset(days: number) {
    const nextTo = range.toDate;
    const nextFrom = addCalendarDays(nextTo, -(days - 1));
    setFromDate(nextFrom);
    setToDate(nextTo);
    apply(nextFrom, nextTo);
  }

  return (
    <form
      className="analytics-filter-bar"
      aria-label={effectiveLabel}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <div className="analytics-filter-bar__title">
        <span aria-hidden="true">◷</span>
        <div>
          <strong>{effectiveLabel}</strong>
          <small>
            {formatAnalyticsRange(range, locale)} · {range.timeZone}
          </small>
        </div>
      </div>
      <div
        className="analytics-filter-bar__presets"
        aria-label={copy.datePresets}
      >
        {[7, 30, 90].map((days) => (
          <button
            key={days}
            type="button"
            className={
              range.fromDate === addCalendarDays(range.toDate, -(days - 1))
                ? "is-active"
                : ""
            }
            onClick={() => applyPreset(days)}
            disabled={busy}
          >
            {copy.days(days)}
          </button>
        ))}
      </div>
      <label>
        <span>{copy.from}</span>
        <input
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          aria-label={copy.startDate}
          disabled={busy}
        />
      </label>
      <label>
        <span>{copy.toInclusive}</span>
        <input
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          aria-label={copy.endDate}
          disabled={busy}
        />
      </label>
      {grouping && onGroupingChange ? (
        <label>
          <span>{copy.groupBy}</span>
          <select
            value={grouping}
            onChange={(event) =>
              onGroupingChange(event.target.value as "DAY" | "WEEK" | "MONTH")
            }
            disabled={busy}
          >
            <option value="DAY">{copy.day}</option>
            <option value="WEEK">{copy.week}</option>
            <option value="MONTH">{copy.month}</option>
          </select>
        </label>
      ) : null}
      <button
        type="submit"
        className="analytics-filter-bar__apply"
        disabled={busy}
      >
        {busy ? copy.updating : copy.apply}
      </button>
      {error ? (
        <p className="analytics-filter-bar__error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
