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

/**
 * Sends an idempotent mutation with the proof rendered for the current
 * workspace. If Better Auth rotated the session, refresh the proof and retry
 * the exact same request once.
 */
export async function mutateWithCurrentCsrf(
  path: string,
  init: RequestInit,
  fallback: string,
) {
  const send = (proof: string) => {
    const headers = new Headers(init.headers);
    headers.set("x-csrf-token", proof);
    return fetch(path, { ...init, headers });
  };

  const initial = fallback || (await currentCsrfProof(""));
  let response = await send(initial);
  if (response.status !== 403) return response;

  const refreshed = await currentCsrfProof(initial);
  if (!refreshed || refreshed === initial) return response;

  response = await send(refreshed);
  return response;
}

/**
 * Uses the proof already rendered by the server on the common path. A second
 * request is made only when Better Auth rotated the session and the server
 * rejects that proof.
 */
export async function postWithCurrentCsrf(path: string, fallback: string) {
  return mutateWithCurrentCsrf(path, { method: "POST" }, fallback);
}
