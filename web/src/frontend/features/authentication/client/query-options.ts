"use client";

import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { PublicSession } from "@/shared/contracts/identity/session";

type SessionPayload = { sessions: PublicSession[]; csrfProof: string };

/**
 * Query state is deliberately limited to public session projections. The
 * CSRF proof is handed to an ephemeral React state callback and is never
 * returned from the query function, so it cannot enter the Query cache.
 */
export function sessionListQueryOptions(onCsrfProof: (proof: string) => void) {
  return queryOptions({
    queryKey: ["identity", "sessions"],
    queryFn: async (): Promise<PublicSession[]> => {
      const response = await fetch("/api/identity/sessions", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("sessions_unavailable");
      const payload = (await response.json()) as SessionPayload;
      onCsrfProof(payload.csrfProof);
      return payload.sessions;
    },
  });
}

export function revokeSessionMutationOptions(csrfProof: string) {
  return mutationOptions({
    mutationKey: ["identity", "session-revoke"],
    mutationFn: async (reference: string) => {
      const response = await fetch(`/api/identity/sessions/${reference}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfProof },
      });
      if (!response.ok) throw new Error("session_revoke_failed");
      return { ok: true as const };
    },
  });
}

/** Resend mutations accept no variables, keeping PII out of mutation state. */
export function resendVerificationMutationOptions(
  send: () => Promise<{ ok: boolean }>,
) {
  return mutationOptions({
    mutationKey: ["identity", "verification-resend"],
    mutationFn: send,
  });
}
