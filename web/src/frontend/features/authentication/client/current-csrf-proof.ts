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
 * Uses the proof already rendered by the server on the common path. A second
 * request is made only when Better Auth rotated the session and the server
 * rejects that proof.
 */
export async function postWithCurrentCsrf(path: string, fallback: string) {
  const send = (proof: string) =>
    fetch(path, {
      method: "POST",
      headers: { "x-csrf-token": proof },
    });

  let response = await send(fallback);
  if (response.status !== 403) return response;

  const refreshed = await currentCsrfProof(fallback);
  if (refreshed === fallback) return response;

  response = await send(refreshed);
  return response;
}
