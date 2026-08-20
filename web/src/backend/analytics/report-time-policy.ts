import "server-only";

import {
  analyticsGroupingSchema,
  type AnalyticsGrouping,
  type MetricRate,
} from "@/shared/contracts/analytics";
import { analyticsConfiguration } from "./analytics-config";

export type ReportBucket = Readonly<{
  start: Date;
  end: Date;
}>;

export type NormalizedReportRange = Readonly<{
  from: Date;
  to: Date;
  timeZone: string;
  grouping: AnalyticsGrouping;
  dataCutoff: Date;
  analyticsAvailableFrom: Date;
  buckets: readonly ReportBucket[];
}>;

export class ReportTimePolicyError extends Error {
  constructor(
    public readonly status: 400 | 404,
    public readonly code:
      | "INVALID_REPORT_RANGE"
      | "ANALYTICS_RANGE_UNAVAILABLE",
    public readonly details?: Readonly<Record<string, string>>,
  ) {
    super(code);
    this.name = "ReportTimePolicyError";
  }
}

type LocalDate = Readonly<{ year: number; month: number; day: number }>;

function validTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function localDateParts(date: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: value.year,
    month: value.month,
    day: value.day,
  };
}

function dateFromLocalMidnight(value: LocalDate, timeZone: string) {
  const utcGuess = Date.UTC(value.year, value.month - 1, value.day);
  let candidate = utcGuess;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const represented = localDateParts(new Date(candidate), timeZone);
    const representedUtc = Date.UTC(
      represented.year,
      represented.month - 1,
      represented.day,
    );
    candidate = utcGuess + (utcGuess - representedUtc);
  }
  return new Date(candidate);
}

function addDays(value: LocalDate, days: number): LocalDate {
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day));
  date.setUTCDate(date.getUTCDate() + days);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function firstGroupingDate(value: LocalDate, grouping: AnalyticsGrouping) {
  if (grouping === "MONTH")
    return { year: value.year, month: value.month, day: 1 };
  if (grouping === "DAY") return value;
  const weekday = new Date(
    Date.UTC(value.year, value.month - 1, value.day),
  ).getUTCDay();
  return addDays(value, weekday === 0 ? -6 : 1 - weekday);
}

function nextGroupingDate(value: LocalDate, grouping: AnalyticsGrouping) {
  if (grouping === "DAY") return addDays(value, 1);
  if (grouping === "WEEK") return addDays(value, 7);
  const month = value.month === 12 ? 1 : value.month + 1;
  return {
    year: value.month === 12 ? value.year + 1 : value.year,
    month,
    day: 1,
  };
}

export function buildReportBuckets(input: {
  from: Date;
  to: Date;
  timeZone: string;
  grouping: AnalyticsGrouping;
}): ReportBucket[] {
  const first = firstGroupingDate(
    localDateParts(input.from, input.timeZone),
    input.grouping,
  );
  const buckets: ReportBucket[] = [];
  let cursor = first;
  while (dateFromLocalMidnight(cursor, input.timeZone) < input.to) {
    const next = nextGroupingDate(cursor, input.grouping);
    const rawStart = dateFromLocalMidnight(cursor, input.timeZone);
    const rawEnd = dateFromLocalMidnight(next, input.timeZone);
    const start = rawStart < input.from ? input.from : rawStart;
    const end = rawEnd > input.to ? input.to : rawEnd;
    if (start < end) buckets.push({ start, end });
    cursor = next;
  }
  return buckets;
}

export function makeMetricRate(
  numerator: number,
  denominator: number,
): MetricRate {
  if (denominator === 0) {
    return {
      numerator,
      denominator,
      value: null,
      availability: "NOT_APPLICABLE",
    };
  }
  return {
    numerator,
    denominator,
    value: roundRate((numerator / denominator) * 100),
    availability: "AVAILABLE",
  };
}

export function roundRate(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeReportRange(input: {
  from: Date;
  to: Date;
  timeZone: string;
  grouping: AnalyticsGrouping;
  now?: Date;
  analyticsAvailableFrom: Date;
}): NormalizedReportRange {
  const configuration = analyticsConfiguration();
  if (
    !(input.from instanceof Date) ||
    Number.isNaN(input.from.getTime()) ||
    !(input.to instanceof Date) ||
    Number.isNaN(input.to.getTime()) ||
    input.from >= input.to ||
    !validTimeZone(input.timeZone) ||
    !analyticsGroupingSchema.safeParse(input.grouping).success
  ) {
    throw new ReportTimePolicyError(400, "INVALID_REPORT_RANGE");
  }
  const maximumEnd = new Date(
    input.from.getTime() + configuration.maxRangeDays * 24 * 60 * 60 * 1_000,
  );
  if (input.to > maximumEnd) {
    throw new ReportTimePolicyError(400, "INVALID_REPORT_RANGE", {
      maxRangeDays: String(configuration.maxRangeDays),
    });
  }
  if (input.from < input.analyticsAvailableFrom) {
    throw new ReportTimePolicyError(404, "ANALYTICS_RANGE_UNAVAILABLE", {
      analyticsAvailableFrom: input.analyticsAvailableFrom.toISOString(),
    });
  }
  const now = input.now ?? new Date();
  const dataCutoff = input.to < now ? input.to : now;
  return {
    from: input.from,
    to: input.to,
    timeZone: input.timeZone,
    grouping: input.grouping,
    dataCutoff,
    analyticsAvailableFrom: input.analyticsAvailableFrom,
    buckets: buildReportBuckets(input),
  };
}
