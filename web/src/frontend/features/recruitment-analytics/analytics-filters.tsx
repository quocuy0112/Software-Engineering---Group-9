"use client";

import { useState } from "react";
import {
  addCalendarDays,
  createAnalyticsDateRange,
  formatAnalyticsRange,
  isValidAnalyticsDateRange,
  type AnalyticsDateRange,
} from "./analytics-date-range";

export function AnalyticsDateRangeControls({
  range,
  onApply,
  grouping,
  onGroupingChange,
  busy = false,
  label = "Reporting window",
}: {
  range: AnalyticsDateRange;
  onApply: (next: AnalyticsDateRange) => void;
  grouping?: "DAY" | "WEEK" | "MONTH";
  onGroupingChange?: (next: "DAY" | "WEEK" | "MONTH") => void;
  busy?: boolean;
  label?: string;
}) {
  const [fromDate, setFromDate] = useState(range.fromDate);
  const [toDate, setToDate] = useState(range.toDate);
  const [error, setError] = useState("");

  function apply(nextFrom = fromDate, nextTo = toDate) {
    if (!isValidAnalyticsDateRange(nextFrom, nextTo)) {
      setError("Choose a start date before the end date.");
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
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <div className="analytics-filter-bar__title">
        <span aria-hidden="true">◷</span>
        <div>
          <strong>{label}</strong>
          <small>
            {formatAnalyticsRange(range)} · {range.timeZone}
          </small>
        </div>
      </div>
      <div className="analytics-filter-bar__presets" aria-label="Date presets">
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
            {days === 7 ? "7 days" : days === 30 ? "30 days" : "90 days"}
          </button>
        ))}
      </div>
      <label>
        <span>From</span>
        <input
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          aria-label="Start date"
          disabled={busy}
        />
      </label>
      <label>
        <span>To (inclusive)</span>
        <input
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          aria-label="End date"
          disabled={busy}
        />
      </label>
      {grouping && onGroupingChange ? (
        <label>
          <span>Group by</span>
          <select
            value={grouping}
            onChange={(event) =>
              onGroupingChange(event.target.value as "DAY" | "WEEK" | "MONTH")
            }
            disabled={busy}
          >
            <option value="DAY">Day</option>
            <option value="WEEK">Week</option>
            <option value="MONTH">Month</option>
          </select>
        </label>
      ) : null}
      <button
        type="submit"
        className="analytics-filter-bar__apply"
        disabled={busy}
      >
        {busy ? "Updating…" : "Apply"}
      </button>
      {error ? (
        <p className="analytics-filter-bar__error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
