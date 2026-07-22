const unsafe = /[\\\u0000-\u001f\u007f-\u009f]/;

export function trustedInternalRedirect(
  value: string | null | undefined,
  applicationUrl: string,
  fallback = "/",
) {
  if (!value || unsafe.test(value) || value.startsWith("//")) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (unsafe.test(decoded) || decoded.startsWith("//")) return fallback;
  try {
    const base = new URL(applicationUrl);
    const target = new URL(decoded, base);
    if (target.origin !== base.origin || target.username || target.password)
      return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
