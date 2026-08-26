export type ProfileDisplayLocale = "en" | "vi";

export function formatProfileDate(
  value: string | null | undefined,
  locale: ProfileDisplayLocale,
) {
  if (!value) return locale === "vi" ? "Hiện tại" : "Present";

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatProfileDateRange(
  start: string,
  end: string | null | undefined,
  current: boolean,
  locale: ProfileDisplayLocale,
) {
  const separator = locale === "vi" ? " – " : " – ";
  return `${formatProfileDate(start, locale)}${separator}${
    current
      ? locale === "vi"
        ? "Hiện tại"
        : "Present"
      : formatProfileDate(end, locale)
  }`;
}
