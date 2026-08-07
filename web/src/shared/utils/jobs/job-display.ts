import type { JobCard } from "@/shared/contracts/jobs/discovery";

type JobSalary = NonNullable<JobCard["salary"]>;
type SalaryDisplayValue = {
  minimum?: number | null;
  maximum?: number | null;
  period?: string | null;
  isNegotiable?: boolean;
};

const periodSuffix: Record<string, string> = {
  hour: "/hour",
  month: "/month",
  year: "/year",
};

const amountFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  useGrouping: false,
});

function hasAmount(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function amount(value: number) {
  return amountFormatter.format(value);
}

export function isSalaryNegotiable(
  salary: JobCard["salary"] | SalaryDisplayValue | null | undefined,
): boolean {
  if (!salary) return true;
  return !hasAmount(salary.minimum) && !hasAmount(salary.maximum);
}

export function formatSalary(
  salary: JobCard["salary"] | SalaryDisplayValue | null | undefined,
): string {
  if (!salary || isSalaryNegotiable(salary)) return "Negotiable";

  const suffix =
    salary.period &&
    (periodSuffix[String(salary.period).toLowerCase()] ??
      "/" + String(salary.period).toLowerCase());
  const minimum = hasAmount(salary.minimum) ? amount(salary.minimum) : null;
  const maximum = hasAmount(salary.maximum) ? amount(salary.maximum) : null;

  if (minimum !== null && maximum !== null)
    return minimum + " - " + maximum + " million" + (suffix ?? "");
  if (maximum !== null) return "Up to " + maximum + " million" + (suffix ?? "");
  if (minimum !== null) return "From " + minimum + " million" + (suffix ?? "");
  return "Negotiable";
}

export function formatRelativeTime(value: string | Date, now = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp)) return "recently";

  const seconds = Math.max(0, Math.floor((now.getTime() - timestamp) / 1000));
  if (seconds < 60) return "just now";

  const units: Array<[number, string]> = [
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
    return String(count) + " " + label + (count === 1 ? "" : "s") + " ago";
  }
  return "just now";
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
