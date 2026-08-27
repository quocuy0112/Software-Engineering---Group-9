import type { JobCard } from "@/shared/contracts/jobs/discovery";

type JobSalary = NonNullable<JobCard["salary"]>;
type SalaryDisplayValue = {
  minimum?: number | null;
  maximum?: number | null;
  period?: string | null;
  isNegotiable?: boolean;
};

export type JobDisplayLocale = "vi" | "en";

const periodSuffix: Record<JobDisplayLocale, Record<string, string>> = {
  en: {
    hour: "/hour",
    month: "/month",
    year: "/year",
  },
  vi: {
    hour: "/giờ",
    month: "/tháng",
    year: "/năm",
  },
};

const amountFormatters: Record<JobDisplayLocale, Intl.NumberFormat> = {
  en: new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    useGrouping: false,
  }),
  vi: new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
    useGrouping: false,
  }),
};

const salaryLabels: Record<
  JobDisplayLocale,
  { from: string; million: string; negotiable: string; upTo: string }
> = {
  en: {
    from: "From",
    million: "million",
    negotiable: "Negotiable",
    upTo: "Up to",
  },
  vi: {
    from: "Từ",
    million: "triệu",
    negotiable: "Thỏa thuận",
    upTo: "Tối đa",
  },
};

function hasAmount(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function amount(value: number, locale: JobDisplayLocale) {
  return amountFormatters[locale].format(value);
}

export function isSalaryNegotiable(
  salary: JobCard["salary"] | SalaryDisplayValue | null | undefined,
): boolean {
  if (!salary) return true;
  return !hasAmount(salary.minimum) && !hasAmount(salary.maximum);
}

export function formatSalary(
  salary: JobCard["salary"] | SalaryDisplayValue | null | undefined,
  locale: JobDisplayLocale = "en",
): string {
  const labels = salaryLabels[locale];
  if (!salary || isSalaryNegotiable(salary)) return labels.negotiable;

  const suffix =
    salary.period &&
    (periodSuffix[locale][String(salary.period).toLowerCase()] ??
      "/" + String(salary.period).toLowerCase());
  const minimum = hasAmount(salary.minimum)
    ? amount(salary.minimum, locale)
    : null;
  const maximum = hasAmount(salary.maximum)
    ? amount(salary.maximum, locale)
    : null;

  if (minimum !== null && maximum !== null)
    return minimum + " - " + maximum + " " + labels.million + (suffix ?? "");
  if (maximum !== null)
    return labels.upTo + " " + maximum + " " + labels.million + (suffix ?? "");
  if (minimum !== null)
    return labels.from + " " + minimum + " " + labels.million + (suffix ?? "");
  return labels.negotiable;
}

export function formatRelativeTime(value: string | Date, now?: Date): string;
export function formatRelativeTime(
  value: string | Date,
  locale?: JobDisplayLocale,
  now?: Date,
): string;
export function formatRelativeTime(
  value: string | Date,
  localeOrNow: JobDisplayLocale | Date = "en",
  now = new Date(),
) {
  const locale = localeOrNow instanceof Date ? "en" : localeOrNow;
  const referenceNow = localeOrNow instanceof Date ? localeOrNow : now;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp))
    return locale === "vi" ? "gần đây" : "recently";

  const seconds = Math.max(
    0,
    Math.floor((referenceNow.getTime() - timestamp) / 1000),
  );
  if (seconds < 60) return locale === "vi" ? "vừa xong" : "just now";

  const formatter = new Intl.RelativeTimeFormat(
    locale === "vi" ? "vi-VN" : "en-US",
    { numeric: "always" },
  );

  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60 * 60 * 24 * 365, "year"],
    [60 * 60 * 24 * 30, "month"],
    [60 * 60 * 24 * 7, "week"],
    [60 * 60 * 24, "day"],
    [60 * 60, "hour"],
    [60, "minute"],
  ];
  for (const [size, label] of units) {
    if (seconds < size) continue;
    const count = Math.floor(seconds / size);
    return formatter.format(-count, label);
  }
  return locale === "vi" ? "vừa xong" : "just now";
}

/**
 * The JSON/Prisma fixtures historically store VND amounts while the
 * candidate-facing JobCard display contract is expressed in millions.
 * Already-normalized values (for example 15 or 18) pass through unchanged.
 */
export function normalizeSalaryAmount(value: number) {
  return value >= 1_000_000 ? value / 1_000_000 : value;
}

export type { JobSalary };
