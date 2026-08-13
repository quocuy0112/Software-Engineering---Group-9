"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type {
  ConnectionNotificationProjection,
  ParticipantProposal,
  ProfessionalConnectionProjection,
} from "@/shared/contracts/connections";
import { useConnectionInvalidation } from "../client/use-connection-invalidation";

async function connectionApi(
  path: string,
  csrfProof: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (init.method && init.method !== "GET")
    headers.set("x-csrf-proof", csrfProof);
  const response = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      body.error?.message ?? "Professional connection request failed.",
    );
  return body;
}

export function ConnectionsWorkspace({
  csrfProof,
  initialProposals,
  initialConnections,
  initialNotifications,
}: {
  csrfProof: string;
  initialProposals: ParticipantProposal[];
  initialConnections: ProfessionalConnectionProjection[];
  initialNotifications: ConnectionNotificationProjection[];
}) {
  const [proposals, setProposals] = useState(initialProposals);
  const [connections, setConnections] = useState(initialConnections);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [proposalBody, connectionBody, notificationBody] = await Promise.all([
      connectionApi("/api/connections/proposals?limit=50", csrfProof),
      connectionApi("/api/connections?limit=50", csrfProof),
      connectionApi("/api/connections/notifications?limit=50", csrfProof),
    ]);
    setProposals(proposalBody.items);
    setConnections(connectionBody.items);
    setNotifications(notificationBody.items);
  }, [csrfProof]);
  const realtime = useConnectionInvalidation(
    useCallback(() => void refresh(), [refresh]),
  );

  async function decide(
    proposal: ParticipantProposal,
    decision: "ACCEPTED" | "DECLINED",
  ) {
    setBusyId(proposal.id);
    setError(null);
    try {
      await connectionApi(
        `/api/connections/proposals/${encodeURIComponent(proposal.id)}/decision`,
        csrfProof,
        {
          method: "POST",
          headers: {
            "if-match-version": String(proposal.version),
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({ decision }),
        },
      );
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to save your decision.",
      );
      await refresh().catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }

  async function disconnect(connection: ProfessionalConnectionProjection) {
    if (
      !window.confirm(
        `End your connection with ${connection.otherParticipant.displayName}? Existing chat history becomes read-only.`,
      )
    )
      return;
    setBusyId(connection.id);
    setError(null);
    try {
      await connectionApi(
        `/api/connections/${encodeURIComponent(connection.id)}/disconnect`,
        csrfProof,
        {
          method: "POST",
          headers: {
            "if-match-version": String(connection.version),
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({ confirmation: true }),
        },
      );
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to end this connection.",
      );
      await refresh().catch(() => undefined);
    } finally {
      setBusyId(null);
    }
  }

  async function markRead(notification: ConnectionNotificationProjection) {
    if (notification.readAt) return;
    await connectionApi(
      `/api/connections/notifications/${encodeURIComponent(notification.id)}/read`,
      csrfProof,
      {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
      },
    );
    setNotifications((items) =>
      items.map((item) =>
        item.id === notification.id
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    );
  }

  const activeProposals = proposals.filter((item) =>
    ["PENDING_BOTH", "PARTIALLY_ACCEPTED"].includes(item.state),
  );
  return (
    <main className="connections-workspace">
      <header className="connections-hero">
        <div>
          <p className="connections-kicker">CONSENT-BASED NETWORK</p>
          <h1>Professional Connections</h1>
          <p>
            Review proposals independently. Messaging opens only after both
            people accept.
          </p>
        </div>
        <span
          className="connections-realtime"
          data-state={realtime.toLowerCase()}
          role="status"
        >
          {realtime === "CONNECTED"
            ? "Realtime connected"
            : realtime === "OFFLINE"
              ? "Offline"
              : "Connecting"}
        </span>
      </header>
      {error ? (
        <p className="connections-alert" role="alert">
          {error}
        </p>
      ) : null}
      <section className="connections-grid">
        <article className="connections-panel">
          <header>
            <div>
              <p>YOUR CONSENT</p>
              <h2>Connection proposals</h2>
            </div>
            <span>{activeProposals.length} pending</span>
          </header>
          {proposals.length === 0 ? (
            <Empty
              title="No proposals"
              copy="A Platform Administrator may introduce two accounts, but cannot connect them without both approvals."
            />
          ) : (
            <div className="connection-card-list">
              {proposals.map((proposal) => {
                const active = ["PENDING_BOTH", "PARTIALLY_ACCEPTED"].includes(
                  proposal.state,
                );
                return (
                  <section className="connection-card" key={proposal.id}>
                    <div className="connection-person">
                      <div className="connection-avatar" aria-hidden="true">
                        {proposal.otherParticipant?.displayName
                          .slice(0, 1)
                          .toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <h3>
                          {proposal.otherParticipant?.displayName ??
                            "Details removed"}
                        </h3>
                        <p>
                          {proposal.reason ??
                            "Proposal detail is no longer retained."}
                        </p>
                      </div>
                    </div>
                    <dl>
                      <div>
                        <dt>Status</dt>
                        <dd data-state={proposal.state.toLowerCase()}>
                          {proposal.state.replaceAll("_", " ")}
                        </dd>
                      </div>
                      <div>
                        <dt>Expires</dt>
                        <dd>
                          {new Date(proposal.expiresAt).toLocaleDateString()}
                        </dd>
                      </div>
                    </dl>
                    {active ? (
                      <div className="connection-actions">
                        <button
                          type="button"
                          className="primary"
                          disabled={
                            busyId === proposal.id ||
                            proposal.myDecision === "ACCEPTED"
                          }
                          onClick={() => void decide(proposal, "ACCEPTED")}
                        >
                          {proposal.myDecision === "ACCEPTED"
                            ? "Accepted — waiting"
                            : "Accept"}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={busyId === proposal.id}
                          onClick={() => void decide(proposal, "DECLINED")}
                        >
                          Decline
                        </button>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </article>
        <article className="connections-panel">
          <header>
            <div>
              <p>MESSAGING ACCESS</p>
              <h2>Your connections</h2>
            </div>
            <span>
              {connections.filter((item) => item.state === "ACCEPTED").length}{" "}
              active
            </span>
          </header>
          {connections.length === 0 ? (
            <Empty
              title="No connections yet"
              copy="After both people accept a proposal, the connection appears here and becomes eligible for private messaging."
            />
          ) : (
            <div className="connection-card-list">
              {connections.map((connection) => (
                <section
                  className="connection-card compact"
                  key={connection.id}
                >
                  <div className="connection-person">
                    <div className="connection-avatar" aria-hidden="true">
                      {connection.otherParticipant.displayName
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>
                    <div>
                      <h3>{connection.otherParticipant.displayName}</h3>
                      <p>
                        {connection.state === "ACCEPTED"
                          ? "Messaging enabled"
                          : "Connection ended — history remains read-only"}
                      </p>
                    </div>
                  </div>
                  <div className="connection-actions">
                    {connection.state === "ACCEPTED" ? (
                      <>
                        <Link className="primary link" href="/messages">
                          Open messages
                        </Link>
                        <button
                          type="button"
                          className="secondary"
                          disabled={busyId === connection.id}
                          onClick={() => void disconnect(connection)}
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <Link className="secondary link" href="/messages">
                        View history
                      </Link>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </article>
        <aside className="connections-panel notifications">
          <header>
            <div>
              <p>UPDATES</p>
              <h2>Notifications</h2>
            </div>
            <span>
              {notifications.filter((item) => !item.readAt).length} unread
            </span>
          </header>
          {notifications.length === 0 ? (
            <Empty
              title="No updates"
              copy="Proposal and connection changes will appear here."
            />
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  data-read={Boolean(notification.readAt)}
                  onClick={() => void markRead(notification)}
                >
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                  <time dateTime={notification.createdAt}>
                    {new Date(notification.createdAt).toLocaleString()}
                  </time>
                </button>
              ))}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function Empty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="connections-empty">
      <span aria-hidden="true">◎</span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}
