"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  revokeSessionMutationOptions,
  sessionListQueryOptions,
} from "@/features/identity/client/query-options";
import { AuthStatus } from "./auth-status";

export function SessionList() {
  const [proof, setProof] = useState("");
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery(sessionListQueryOptions(setProof));
  const revokeMutation = useMutation({
    ...revokeSessionMutationOptions(proof),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["identity", "sessions"],
      });
    },
  });
  const sessions = sessionsQuery.data ?? [];
  const status = sessionsQuery.isPending
    ? "Loading sessions."
    : sessionsQuery.isError
      ? "Unable to load sessions."
      : revokeMutation.isSuccess
        ? "Session revoked."
        : revokeMutation.isError
          ? "Unable to revoke session."
          : "";

  return (
    <section>
      <h1>Sessions</h1>
      <AuthStatus
        status={status}
        tone={status.startsWith("Unable") ? "error" : "message"}
      />
      <ul>
        {sessions.map((session) => (
          <li key={session.reference}>
            <strong>
              {session.device}
              {session.current ? " (current)" : ""}
            </strong>
            <p>
              {session.approximateLocation} · Last active{" "}
              {new Date(session.lastActiveAt).toLocaleString()}
            </p>
            {!session.current ? (
              <button
                type="button"
                onClick={() => revokeMutation.mutate(session.reference)}
                disabled={revokeMutation.isPending}
              >
                Revoke session
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
