const SECRET_KEY =
  /(password|cookie|token|secret|otp|backup.?code|authorization|jwt|proof|verification.?link|recipient|csrf|session|raw.?headers?|forwarded.?for|remote.?address|(?:client|remote|raw).?ip|ip.?address|nonce|profile|request.?body|response.?body|provider.?error|database.?error|error|stack|cause|image|pixel|ocr.?text|native.?text|proposal|filter|evidence|prompt|filename|storage.?locator|encryption|capability|idempotency|provider.?request|account.?id|email|company)/i;
const URL_SECRET =
  /([?&#](?:token|code|secret|password|proof|csrf|session)=)[^&#\s]+/gi;

export const REDACTED = "[REDACTED]";

export function redactText(value: string): string {
  return value
    .replace(/\b(Cookie\s*:)\s*[^\r\n]+/gi, `$1 ${REDACTED}`)
    .replace(/\b(Authorization\s*:)\s*[^\r\n]+/gi, `$1 ${REDACTED}`)
    .replace(
      /\b((?:smtp_)?password|authorization|token|secret|otp|backup.?code|jwt|proof|verification.?link|recipient|csrf|session(?:id|token)?|raw.?headers?|profile(?:body|payload)?)\s*([=:])\s*(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s,;]+)/gi,
      `$1$2${REDACTED}`,
    )
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
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return /^[A-Z][A-Z0-9_]{0,79}$/u.test(error.code)
      ? error.code
      : "INTERNAL_ERROR";
  }
  return "INTERNAL_ERROR";
}
