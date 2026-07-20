const SECRET_KEY = /(password|cookie|token|secret|otp|backup.?code|authorization|jwt)/i;
const URL_SECRET = /([?&](?:token|code|secret|password)=)[^&\s]+/gi;

export const REDACTED = "[REDACTED]";

export function redactText(value: string): string {
  return value
    .replace(URL_SECRET, `$1${REDACTED}`)
    .replace(/\bBearer\s+[^\s]+/gi, `Bearer ${REDACTED}`)
    .replace(/\b(?:\d{6}|[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2,})\b/g, REDACTED);
}

export function redactUnknown(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactUnknown);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SECRET_KEY.test(key) ? REDACTED : redactUnknown(entry),
    ]),
  );
}

export function safeErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return redactText(error.code).slice(0, 80);
  }
  return "INTERNAL_ERROR";
}
