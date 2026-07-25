/**
 * Refreshes the ephemeral CSRF proof from the authoritative current session.
 *
 * Better Auth can rotate the session while enabling or disabling 2FA. Server
 * layouts rendered before that rotation still hold a proof for the previous
 * session, so sensitive client actions must refresh it before submitting.
 */
export async function currentCsrfProof(fallback: string) {
  try {
    const response = await fetch("/api/identity/sessions", {
      cache: "no-store",
    });
    if (!response.ok) return fallback;
    const body = (await response.json()) as { csrfProof?: unknown };
    return typeof body.csrfProof === "string" && body.csrfProof.length > 0
      ? body.csrfProof
      : fallback;
  } catch {
    return fallback;
  }
}
