import { ANALYTICS_PLATFORM_TIME_ZONE } from "@/shared/contracts/analytics";

export type AnalyticsDateRange = {
  fromDate: string;
  toDate: string;
  from: string;
  to: string;
  timeZone: typeof ANALYTICS_PLATFORM_TIME_ZONE;
};

function datePartsInTimeZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_PLATFORM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return (
    String(values.year) +
    "-" +
    String(values.month).padStart(2, "0") +
    "-" +
    String(values.day).padStart(2, "0")
  );
}

export function todayInAnalyticsTimeZone() {
  return datePartsInTimeZone(new Date());
}

export function addCalendarDays(value: string, days: number) {
  const date = new Date(value + "T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function createAnalyticsDateRange(
  fromDate: string,
  toDate: string,
): AnalyticsDateRange {
  const exclusiveToDate = addCalendarDays(toDate, 1);
  return {
    fromDate,
    toDate,
    from: fromDate + "T00:00:00+07:00",
    to: exclusiveToDate + "T00:00:00+07:00",
    timeZone: ANALYTICS_PLATFORM_TIME_ZONE,
  };
}

export function defaultAnalyticsDateRange(days = 30) {
  const today = todayInAnalyticsTimeZone();
  return createAnalyticsDateRange(
    addCalendarDays(today, -(Math.max(1, days) - 1)),
    today,
  );
}

export function formatAnalyticsDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value + "T00:00:00.000Z"));
}

export function formatAnalyticsRange(range: AnalyticsDateRange) {
  return (
    formatAnalyticsDate(range.fromDate) +
    " – " +
    formatAnalyticsDate(range.toDate)
  );
}

export function isValidAnalyticsDateRange(fromDate: string, toDate: string) {
  return Boolean(
    /^\d{4}-\d{2}-\d{2}$/u.test(fromDate) &&
    /^\d{4}-\d{2}-\d{2}$/u.test(toDate) &&
    fromDate <= toDate,
  );
}
