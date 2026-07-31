"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  revokeSessionMutationOptions,
  sessionListQueryOptions,
} from "@/frontend/features/authentication/client/query-options";
import { AuthStatus } from "@/frontend/features/authentication/components/auth-status";
import { AppProviders } from "@/frontend/providers/app-providers";
import { Badge } from "@/frontend/components/ui/badge";
import { EmptyState } from "@/frontend/components/ui/empty-state";

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
          : "Sessions loaded successfully.";
  const statusTone =
    sessionsQuery.isError || revokeMutation.isError
      ? "error"
      : sessionsQuery.isSuccess || revokeMutation.isSuccess
        ? "success"
        : "message";

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
          <Badge className="page-heading-badge" tone="info">
            {sessions.length} active
          </Badge>
        </header>
      ) : null}
      <AuthStatus id="session-list-status" status={status} tone={statusTone} />
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
        <EmptyState
          className="session-empty"
          icon="□"
          title="No active sessions"
          description="No active sessions are available to display."
        />
      ) : null}
    </section>
  );
}
