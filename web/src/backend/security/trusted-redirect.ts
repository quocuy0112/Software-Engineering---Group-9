function hasUnsafeCharacter(value: string) {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return character === "\\" || code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
}

export function trustedInternalRedirect(
  value: string | null | undefined,
  applicationUrl: string,
  fallback = "/",
) {
  if (!value || hasUnsafeCharacter(value) || value.startsWith("//"))
    return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (hasUnsafeCharacter(decoded) || decoded.startsWith("//")) return fallback;
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
