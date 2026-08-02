export type TimezoneOption = {
  label: string;
  value: string;
};

const fallbackTimezones = [
  "UTC",
  "Asia/Ho_Chi_Minh",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Europe/Paris",
  "America/New_York",
] as const;

function formatOffset(value: string): string {
  if (value === "GMT") return "GMT+00:00";
  const match = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(value);
  if (!match) return value;
  return `GMT${match[1]}${match[2].padStart(2, "0")}:${match[3] ?? "00"}`;
}

function getOffset(timezone: string, now: Date): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(now)
      .find(({ type }) => type === "timeZoneName");
    return formatOffset(part?.value ?? "GMT");
  } catch {
    return "GMT";
  }
}

function formatRegionName(timezone: string): string {
  return timezone.replaceAll("_", " ").replace("/", " — ");
}

/**
 * Uses the browser's ICU/IANA data so the picker only suggests timezone IDs
 * this device can resolve. UTC and existing application values are retained
 * because ECMAScript exposes only primary IANA identifiers in supportedValuesOf.
 */
export function getTimezoneOptions(
  additionalTimezones: readonly string[] = [],
  now = new Date(),
): TimezoneOption[] {
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : fallbackTimezones;
  const timezones = [...new Set(["UTC", ...additionalTimezones, ...supported])];

  return timezones
    .map((timezone) => {
      const offset = getOffset(timezone, now);
      return {
        value: timezone,
        label: `${offset} · ${formatRegionName(timezone)}`,
      };
    })
    .sort((first, second) => first.label.localeCompare(second.label, "en"));
}
