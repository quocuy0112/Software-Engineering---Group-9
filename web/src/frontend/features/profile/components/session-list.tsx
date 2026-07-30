"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  revokeSessionMutationOptions,
  sessionListQueryOptions,
} from "@/frontend/features/authentication/client/query-options";
import { AuthStatus } from "@/frontend/features/authentication/components/auth-status";
import { AppProviders } from "@/frontend/providers/app-providers";

export function SessionList({ embedded = false }: { embedded?: boolean }) {
  return (
    <AppProviders>
      <SessionListContent embedded={embedded} />
    </AppProviders>
  );
}

function SessionListContent({ embedded = false }: { embedded?: boolean }) {
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
    <section
      className={
        embedded ? "sessions-page sessions-page--embedded" : "sessions-page"
      }
    >
      {!embedded ? (
        <header className="page-heading">
          <div>
            <p className="workspace-kicker">ACTIVE ACCESS</p>
            <h1 id="workspace-page-title">Sessions</h1>
            <p className="page-heading-copy">
              Review the devices that can currently access your SmartHire
              account.
            </p>
          </div>
          <span className="page-heading-badge">{sessions.length} active</span>
        </header>
      ) : null}
      <AuthStatus
        status={status}
        tone={status.startsWith("Unable") ? "error" : "message"}
      />
      <div className="sessions-panel-heading">
        <div>
          <p className="panel-kicker">SIGNED-IN DEVICES</p>
          <h2>Signed-in devices</h2>
        </div>
        <p>Revoke any device you do not recognize.</p>
      </div>
      <ul className="session-list">
        {sessions.map((session) => (
          <li className="session-item" key={session.reference}>
            <span className="session-device-icon" aria-hidden="true">
              □
            </span>
            <div className="session-details">
              <strong>
                {session.device}
                {session.current ? " (current)" : ""}
              </strong>
              <p>
                {session.approximateLocation} · Last active{" "}
                {new Date(session.lastActiveAt).toLocaleString()}
              </p>
            </div>
            {!session.current ? (
              <button
                className="session-revoke-button"
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
      {!sessionsQuery.isPending && sessions.length === 0 ? (
        <div className="session-empty">
          <span aria-hidden="true">□</span>
          <p>No active sessions are available to display.</p>
        </div>
      ) : null}
    </section>
  );
}
